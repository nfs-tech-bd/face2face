class WebRTCClient {
    constructor(roomId, clientId, userName) {
        this.roomId = roomId;
        this.clientId = clientId;
        this.userName = userName;
        this.peers = {};
        this.localStream = null;
        this.screenStream = null;
        this.isVideoEnabled = true;
        this.isAudioEnabled = true;
        this.isScreenSharing = false;
        this.connectionTimeout = 10000; // 10 seconds timeout for connections
        this.connectionAttempts = {};
        this.maxConnectionAttempts = 3;
        this.participants = {};
        this.handRaised = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.peerQuality = {}; // {peerId: 'good'|'ok'|'poor'}
        this.connect();
        this.setupEventListeners();
        setInterval(() => this.updateNetworkQuality(), 3000);
    }

    async connect() {
        try {
            this.ws = new WebSocket(`wss://${window.location.host}/ws/${this.roomId}/${this.clientId}?name=${encodeURIComponent(this.userName)}`);
            
            this.ws.onmessage = async (event) => {
                const message = JSON.parse(event.data);
                await this.handleMessage(message);
            };

            this.ws.onclose = () => {
                console.log('WebSocket connection closed');
                // Attempt to reconnect after 3 seconds
                setTimeout(() => this.connect(), 3000);
            };
        } catch (error) {
            console.error('WebSocket connection error:', error);
            setTimeout(() => this.connect(), 3000);
        }
    }

    async setupEventListeners() {
        // Get local media stream
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            const localVideo = document.getElementById('localVideo');
            localVideo.srcObject = this.localStream;
            
            // Update video label
            const videoLabel = localVideo.parentElement.querySelector('.video-label');
            videoLabel.textContent = this.userName;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            alert('Error accessing camera and microphone. Please make sure you have granted the necessary permissions.');
        }

        // Setup control buttons
        document.getElementById('toggleVideo').addEventListener('click', () => this.toggleVideo());
        document.getElementById('toggleAudio').addEventListener('click', () => this.toggleAudio());
        // Screen sharing button: detect support
        const toggleScreenBtn = document.getElementById('toggleScreen');
        if (!navigator.mediaDevices.getDisplayMedia) {
            toggleScreenBtn.style.display = 'none';
        } else {
            toggleScreenBtn.addEventListener('click', () => this.toggleScreenShare());
        }

        // Recording button
        const recordBtn = document.getElementById('recordBtn');
        const recordIcon = document.getElementById('recordIcon');
        const recordingIndicator = document.getElementById('recordingIndicator');
        recordBtn.addEventListener('click', async () => {
            if (!this.isRecording) {
                await this.startRecording();
                recordBtn.title = 'Stop Recording';
                recordIcon.style.color = 'red';
                recordingIndicator.style.display = 'inline';
            } else {
                await this.stopRecording();
                recordBtn.title = 'Start Recording';
                recordIcon.style.color = 'red';
                recordingIndicator.style.display = 'none';
            }
        });
    }

    async handleMessage(message) {
        switch (message.type) {
            case 'room-info':
                this.handleRoomInfo(message);
                break;
            case 'user-joined':
                this.handleUserJoined(message);
                break;
            case 'user-left':
                this.handleUserLeft(message);
                break;
            case 'offer':
                await this.handleOffer(message);
                break;
            case 'answer':
                await this.handleAnswer(message);
                break;
            case 'ice-candidate':
                await this.handleIceCandidate(message);
                break;
            case 'chat':
                this.handleChatMessage(message);
                break;
            case 'hand-status':
                this.handleHandStatus(message);
                break;
            case 'chat-file':
                this.handleChatFileMessage(message);
                break;
            case 'whiteboard-draw':
                this.handleWhiteboardDraw(message);
                break;
            case 'whiteboard-clear':
                this.handleWhiteboardClear();
                break;
            case 'kick-user':
                if (message.target === this.clientId) {
                    alert('You have been removed from the room by a host.');
                    window.location.href = '/';
                }
                break;
            case 'promote-host':
                if (message.target === this.clientId) {
                    window.IS_HOST = true;
                    alert('You have been promoted to host!');
                    location.reload();
                }
                break;
            case 'mute-all':
                this.muteAll();
                break;
        }
    }

    handleRoomInfo(message) {
        const participants = message.participants;
        this.participants = {};
        for (const [clientId, userName] of Object.entries(participants)) {
            this.participants[clientId] = { name: userName, handRaised: false };
        }
        this.updateParticipantPanel();
        // Store and expose meetingStartTime for timer sync
        if (message.meetingStartTime) {
            window.meetingStartTime = message.meetingStartTime;
            if (window.setMeetingStartTime) window.setMeetingStartTime(message.meetingStartTime);
        }
        // Create peer connections after updating participant list
        for (const [clientId, userName] of Object.entries(participants)) {
            if (clientId !== this.clientId) {
                this.createPeerConnection(clientId, this.participants[clientId]?.name || userName || 'Unknown');
            }
        }
    }

    handleUserJoined(message) {
        const { client_id, user_name } = message;
        this.participants[client_id] = { name: user_name, handRaised: false };
        this.updateParticipantPanel();
        // Always use the name from the participant list
        this.createPeerConnection(client_id, this.participants[client_id]?.name || user_name || 'Unknown');
    }

    handleUserLeft(message) {
        const { client_id } = message;
        delete this.participants[client_id];
        this.updateParticipantPanel();
        this.removePeerConnection(client_id);
        // Always remove the video element, even if peer connection is already gone
        const videoWrapper = document.getElementById(`video-${client_id}`);
        if (videoWrapper) {
            videoWrapper.remove();
        }
    }

    handleHandStatus(message) {
        const { sender, handRaised } = message;
        if (this.participants[sender]) {
            this.participants[sender].handRaised = handRaised;
            this.updateParticipantPanel();
        }
    }

    updateParticipantPanel() {
        if (window.updateParticipantList) {
            const list = Object.entries(this.participants).map(([id, p]) => ({
                id,
                name: p.name + (id === this.clientId ? ' (You)' : ''),
                isSelf: id === this.clientId,
                isHost: !!p.isHost,
                quality: this.peerQuality[id] || 'good'
            }));
            window.updateParticipantList(list);
        }
        // Update video labels if names have changed
        for (const [id, p] of Object.entries(this.participants)) {
            const label = document.getElementById(`video-label-${id}`);
            if (label && label.textContent !== p.name) {
                label.textContent = p.name;
            }
        }
    }

    async createPeerConnection(clientId, userName) {
        if (this.peers[clientId]) {
            console.log(`Peer connection for ${clientId} already exists`);
            return;
        }
        // Remove any existing video element for this clientId before creating a new one
        const oldVideoWrapper = document.getElementById(`video-${clientId}`);
        if (oldVideoWrapper) {
            oldVideoWrapper.remove();
        }
        // Use the latest name from the participant list if available
        const displayName = this.participants[clientId]?.name || userName || 'Unknown';
        const peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        // Add a loading spinner while waiting for remote video
        const videoContainer = document.getElementById('videoContainer');
        const videoWrapper = document.createElement('div');
        videoWrapper.className = 'video-wrapper';
        videoWrapper.id = `video-${clientId}`;
        videoWrapper.innerHTML = `
            <div class="video-label">${displayName}</div>
            <div class="video-loading-spinner" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2;">
                <div class="spinner" style="border:4px solid #f3f3f3;border-top:4px solid #2196F3;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;"></div>
            </div>
        `;
        videoContainer.appendChild(videoWrapper);

        // Set a timeout to remove the video if no stream is received
        const videoTimeout = setTimeout(() => {
            const wrapper = document.getElementById(`video-${clientId}`);
            if (wrapper && !wrapper.querySelector('video')) {
                wrapper.innerHTML = `<div class="video-label">${displayName}</div><div class="video-error" style="color:#fff;background:rgba(244,67,54,0.8);padding:8px;border-radius:4px;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2;">No video received from ${displayName}.<br>Please check their connection or permissions.</div>`;
                setTimeout(() => {
                    if (wrapper) wrapper.remove();
                }, 4000);
            }
        }, 7000); // 7 seconds

        // Add local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendMessage({
                    type: 'ice-candidate',
                    target: clientId,
                    candidate: event.candidate
                });
            }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log(`Connection state for ${clientId}: ${peerConnection.connectionState}`);
            if (peerConnection.connectionState === 'failed') {
                this.handleConnectionFailure(clientId);
            }
        };

        // Handle ICE connection state changes
        peerConnection.oniceconnectionstatechange = () => {
            console.log(`ICE connection state for ${clientId}: ${peerConnection.iceConnectionState}`);
            if (peerConnection.iceConnectionState === 'failed') {
                this.handleConnectionFailure(clientId);
            }
        };

        // Handle incoming tracks
        peerConnection.ontrack = (event) => {
            // Remove any existing video element for this clientId before adding a new one
            const oldVideoWrapper = document.getElementById(`video-${clientId}`);
            if (oldVideoWrapper) {
                oldVideoWrapper.remove();
            }
            const videoContainer = document.getElementById('videoContainer');
            const videoWrapper = document.createElement('div');
            videoWrapper.className = 'video-wrapper';
            videoWrapper.id = `video-${clientId}`;

            const video = document.createElement('video');
            video.id = `video-${clientId}`;
            video.autoplay = true;
            video.playsInline = true;
            video.srcObject = event.streams[0];

            const label = document.createElement('div');
            label.className = 'video-label';
            label.textContent = displayName;
            label.id = `video-label-${clientId}`;

            videoWrapper.appendChild(video);
            videoWrapper.appendChild(label);
            videoContainer.appendChild(videoWrapper);

            // Remove loading spinner and timeout
            clearTimeout(videoTimeout);
        };

        this.peers[clientId] = peerConnection;

        // Create and send offer
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            this.sendMessage({
                type: 'offer',
                target: clientId,
                sdp: offer
            });
        } catch (error) {
            console.error('Error creating offer:', error);
            this.handleConnectionFailure(clientId);
        }
    }

    async handleOffer(message) {
        const { sender, sdp, user_name } = message;
        const peerConnection = this.peers[sender] || await this.createPeerConnection(sender, user_name);
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            this.sendMessage({
                type: 'answer',
                target: sender,
                sdp: answer
            });
        } catch (error) {
            console.error('Error handling offer:', error);
            this.handleConnectionFailure(sender);
        }
    }

    async handleAnswer(message) {
        const { sender, sdp } = message;
        const peerConnection = this.peers[sender];

        if (peerConnection) {
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
            } catch (error) {
                console.error('Error handling answer:', error);
                this.handleConnectionFailure(sender);
            }
        }
    }

    async handleIceCandidate(message) {
        const { sender, candidate } = message;
        const peerConnection = this.peers[sender];

        if (peerConnection) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    }

    handleConnectionFailure(clientId) {
        if (!this.connectionAttempts[clientId]) {
            this.connectionAttempts[clientId] = 0;
        }

        if (this.connectionAttempts[clientId] < this.maxConnectionAttempts) {
            this.connectionAttempts[clientId]++;
            console.log(`Attempting to reconnect to ${clientId} (Attempt ${this.connectionAttempts[clientId]})`);
            
            // Remove existing connection
            this.removePeerConnection(clientId);
            
            // Wait before attempting to reconnect
            setTimeout(() => {
                this.createPeerConnection(clientId, this.peers[clientId]?.userName || 'Unknown');
            }, 2000);
        } else {
            console.log(`Max connection attempts reached for ${clientId}`);
            this.removePeerConnection(clientId);
        }
    }

    removePeerConnection(clientId) {
        const peerConnection = this.peers[clientId];
        if (peerConnection) {
            peerConnection.close();
            delete this.peers[clientId];
        }

        // Remove video element
        const videoWrapper = document.getElementById(`video-${clientId}`);
        if (videoWrapper) {
            videoWrapper.remove();
        }

        delete this.connectionAttempts[clientId];
    }

    async toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                this.isVideoEnabled = !this.isVideoEnabled;
                videoTrack.enabled = this.isVideoEnabled;
                
                const button = document.getElementById('toggleVideo');
                button.querySelector('img').src = `/static/img/video-${this.isVideoEnabled ? 'on' : 'off'}.svg`;
            }
        }
    }

    async toggleAudio() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                this.isAudioEnabled = !this.isAudioEnabled;
                audioTrack.enabled = this.isAudioEnabled;
                
                const button = document.getElementById('toggleAudio');
                button.querySelector('img').src = `/static/img/mic-${this.isAudioEnabled ? 'on' : 'off'}.svg`;
            }
        }
    }

    async toggleScreenShare() {
        if (!navigator.mediaDevices.getDisplayMedia) {
            alert('Screen sharing is not supported on your device/browser.');
            return;
        }
        try {
            if (!this.isScreenSharing) {
                this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true
                });

                // Replace video track in all peer connections
                const videoTrack = this.screenStream.getVideoTracks()[0];
                Object.values(this.peers).forEach(peer => {
                    const sender = peer.getSenders().find(s => s.track.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(videoTrack);
                    }
                });

                // Update local video
                const localVideo = document.getElementById('localVideo');
                localVideo.srcObject = this.screenStream;

                this.isScreenSharing = true;
                document.getElementById('toggleScreen').classList.add('active');

                // Handle when user stops sharing via browser UI
                this.screenStream.getVideoTracks()[0].onended = () => {
                    this.stopScreenShare();
                };
            } else {
                await this.stopScreenShare();
            }
        } catch (error) {
            console.error('Error toggling screen share:', error);
            alert('Failed to start screen sharing. Please try again.');
        }
    }

    async stopScreenShare() {
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            
            // Restore video track in all peer connections
            if (this.localStream) {
                const videoTrack = this.localStream.getVideoTracks()[0];
                Object.values(this.peers).forEach(peer => {
                    const sender = peer.getSenders().find(s => s.track.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(videoTrack);
                    }
                });

                // Restore local video
                const localVideo = document.getElementById('localVideo');
                localVideo.srcObject = this.localStream;
            }

            this.isScreenSharing = false;
            document.getElementById('toggleScreen').classList.remove('active');
        }
    }

    handleChatMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${message.sender === this.clientId ? 'sent' : 'received'}`;
        
        const senderName = message.sender === this.clientId ? 'You' : message.user_name || 'Unknown';
        const timestamp = new Date(message.timestamp).toLocaleTimeString();
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="sender">${senderName}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${message.message}</div>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    handleChatFileMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${message.sender === this.clientId ? 'sent' : 'received'}`;
        const senderName = message.sender === this.clientId ? 'You' : message.user_name || 'Unknown';
        const timestamp = new Date(message.timestamp).toLocaleTimeString();
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="sender">${senderName}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">
                <a href="${message.fileData}" download="${message.fileName}" target="_blank">📎 ${message.fileName}</a>
            </div>
        `;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    handleWhiteboardDraw(message) {
        const canvas = document.getElementById('whiteboardCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = message.color;
        ctx.lineWidth = message.width;
        ctx.beginPath();
        ctx.moveTo(message.x1, message.y1);
        ctx.lineTo(message.x2, message.y2);
        ctx.stroke();
    }

    handleWhiteboardClear() {
        const canvas = document.getElementById('whiteboardCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    async startRecording() {
        // Show warning if not supported
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (!window.MediaRecorder || isIOS) {
            alert('Recording is not supported on this device/browser.');
            return;
        }
        // Record all visible video and audio (local + remote) in a grid layout
        const videoContainer = document.getElementById('videoContainer');
        const videos = Array.from(videoContainer.querySelectorAll('video'));
        const names = videos.map(video => {
            const wrapper = video.closest('.video-wrapper');
            const label = wrapper ? wrapper.querySelector('.video-label') : null;
            return label ? label.textContent : '';
        });
        // Determine grid size (e.g., 2x2, 3x3)
        const n = videos.length;
        const cols = Math.ceil(Math.sqrt(n));
        const rows = Math.ceil(n / cols);
        const cellWidth = 320;
        const cellHeight = 180;
        const width = cols * cellWidth;
        const height = rows * cellHeight;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.font = '16px Segoe UI, Arial';
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'left';
        // Draw videos to canvas in grid
        let animationFrame;
        const draw = () => {
            ctx.clearRect(0, 0, width, height);
            videos.forEach((video, i) => {
                const row = Math.floor(i / cols);
                const col = i % cols;
                const x = col * cellWidth;
                const y = row * cellHeight;
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(x, y, cellWidth, cellHeight, 12);
                ctx.clip();
                ctx.drawImage(video, x, y, cellWidth, cellHeight);
                ctx.restore();
                // Draw name overlay
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(x, y + cellHeight - 28, cellWidth, 28);
                ctx.fillStyle = '#fff';
                ctx.fillText(names[i], x + 12, y + cellHeight - 8);
            });
            animationFrame = requestAnimationFrame(draw);
        };
        draw();
        // Capture canvas as stream
        const canvasStream = canvas.captureStream(25);
        // Mix all audio tracks
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const destination = audioContext.createMediaStreamDestination();
        videos.forEach(video => {
            try {
                const source = audioContext.createMediaElementSource(video);
                source.connect(destination);
            } catch (e) {}
        });
        // Combine video and audio
        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...destination.stream.getAudioTracks()
        ]);
        // Start recording
        this.mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9,opus' });
        this.recordedChunks = [];
        this.mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) this.recordedChunks.push(e.data);
        };
        this.mediaRecorder.onstop = () => {
            cancelAnimationFrame(animationFrame);
            audioContext.close();
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `meeting-recording-${Date.now()}.webm`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);
        };
        this.mediaRecorder.start();
        this.isRecording = true;
    }

    async stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
        }
    }

    muteAll() {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });
        }
    }

    async updateNetworkQuality() {
        for (const [peerId, pc] of Object.entries(this.peers)) {
            if (pc.connectionState === 'connected') {
                try {
                    const stats = await pc.getStats();
                    let bitrate = 0, packetsLost = 0, rtt = 0, count = 0;
                    stats.forEach(report => {
                        if (report.type === 'outbound-rtp' && report.kind === 'video') {
                            bitrate += report.bytesSent || 0;
                        }
                        if (report.type === 'remote-inbound-rtp') {
                            packetsLost += report.packetsLost || 0;
                            rtt += report.roundTripTime || 0;
                            count++;
                        }
                    });
                    let quality = 'good';
                    if (packetsLost > 10 || rtt / (count || 1) > 0.5) quality = 'poor';
                    else if (packetsLost > 0 || rtt / (count || 1) > 0.2) quality = 'ok';
                    this.peerQuality[peerId] = quality;
                    // Fallback to audio-only if poor
                    if (quality === 'poor') {
                        this.setPeerVideoEnabled(peerId, false);
                    }
                } catch (e) {}
            }
        }
        this.updateParticipantPanel();
    }

    setPeerVideoEnabled(peerId, enabled) {
        // Optionally, send a message to the peer to disable their video
        // For now, just update UI (future: send message to peer)
        // Not implemented in this step
    }
}

// Initialize WebRTC client when the page loads
window.addEventListener('load', () => {
    window.webrtcClient = new WebRTCClient(ROOM_ID, CLIENT_ID, USER_NAME);
});

window.sendWhiteboard = function(data) {
    if (!window.webrtcClient) return;
    if (data === 'clear') {
        window.webrtcClient.sendMessage({ type: 'whiteboard-clear' });
    } else {
        window.webrtcClient.sendMessage({ type: 'whiteboard-draw', ...data });
    }
}; 