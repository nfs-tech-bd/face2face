document.addEventListener('DOMContentLoaded', () => {
    // Chat panel functionality
    const chatPanel = document.getElementById('chatPanel');
    const toggleChatBtn = document.getElementById('toggleChat');
    const closeChatBtn = document.getElementById('closeChat');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessage');
    const chatMessages = document.getElementById('chatMessages');

    // Toggle chat panel
    toggleChatBtn.addEventListener('click', () => {
        chatPanel.classList.toggle('active');
    });

    // Close chat panel
    closeChatBtn.addEventListener('click', () => {
        chatPanel.classList.remove('active');
    });

    // Send message
    function sendMessage() {
        const message = messageInput.value.trim();
        if (message) {
            window.webrtcClient.sendMessage({
                type: 'chat',
                message: message
            });
            messageInput.value = '';
        }
    }

    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Copy room ID
    const copyRoomIdBtn = document.getElementById('copyRoomId');
    if (copyRoomIdBtn) {
        copyRoomIdBtn.addEventListener('click', () => {
            const roomId = document.getElementById('roomIdDisplay').textContent;
            navigator.clipboard.writeText(roomId).then(() => {
                const originalText = copyRoomIdBtn.textContent;
                copyRoomIdBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyRoomIdBtn.textContent = originalText;
                }, 2000);
            });
        });
    }

    // Handle window resize
    function handleResize() {
        const videoContainer = document.getElementById('videoContainer');
        const videos = videoContainer.querySelectorAll('.video-wrapper');
        
        if (videos.length <= 2) {
            videoContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
        } else if (videos.length <= 4) {
            videoContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
        } else {
            videoContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        }
    }

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Page is hidden, pause video
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.pause();
            }
        } else {
            // Page is visible, resume video
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.play().catch(error => console.error('Error resuming video:', error));
            }
        }
    });

    // Handle beforeunload
    window.addEventListener('beforeunload', () => {
        // Clean up WebRTC connections
        if (window.webrtcClient) {
            Object.values(window.webrtcClient.peers).forEach(peer => {
                peer.close();
            });
        }
    });

    // Meeting timer (sync with meetingStartTime)
    let meetingTimer = document.getElementById('meetingTimer');
    let timerInterval = null;
    function startMeetingTimer(startTime) {
        if (timerInterval) clearInterval(timerInterval);
        function updateTimer() {
            const elapsed = Date.now() - startTime * 1000;
            const hours = String(Math.floor(elapsed / 3600000)).padStart(2, '0');
            const minutes = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, '0');
            const seconds = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');
            meetingTimer.textContent = `${hours}:${minutes}:${seconds}`;
        }
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
    }
    window.setMeetingStartTime = function(startTime) {
        startMeetingTimer(startTime);
    };
    // If meetingStartTime is already set (from server), start timer
    if (window.meetingStartTime) {
        startMeetingTimer(window.meetingStartTime);
    }

    // Participant panel toggle
    const participantPanel = document.getElementById('participantPanel');
    const toggleParticipants = document.getElementById('toggleParticipants');
    const closeParticipants = document.getElementById('closeParticipants');
    toggleParticipants.addEventListener('click', () => {
        participantPanel.classList.add('active');
    });
    closeParticipants.addEventListener('click', () => {
        participantPanel.classList.remove('active');
    });

    // Show host controls if user is host
    if (window.IS_HOST) {
        document.getElementById('hostControls').style.display = 'block';
    }
    // Update participant list to show host controls
    window.updateParticipantList = function(participants) {
        const list = document.getElementById('participantList');
        list.innerHTML = '';
        participants.forEach(p => {
            const dotClass = p.quality === 'good' ? 'network-quality-good' : (p.quality === 'ok' ? 'network-quality-ok' : 'network-quality-poor');
            const li = document.createElement('li');
            li.innerHTML = `<span class="network-quality-dot ${dotClass}"></span><span class="participant-status"></span> <span>${p.name}</span>`;
            if (window.IS_HOST && !p.isSelf) {
                li.innerHTML += ` <button class="removeBtn" data-id="${p.id}">Remove</button> <button class="promoteBtn" data-id="${p.id}">Promote to Host</button>`;
            }
            list.appendChild(li);
        });
        // Add event listeners for remove/promote
        if (window.IS_HOST) {
            list.querySelectorAll('.removeBtn').forEach(btn => {
                btn.addEventListener('click', e => {
                    window.webrtcClient.sendMessage({ type: 'kick-user', target: btn.dataset.id });
                });
            });
            list.querySelectorAll('.promoteBtn').forEach(btn => {
                btn.addEventListener('click', e => {
                    window.webrtcClient.sendMessage({ type: 'promote-host', target: btn.dataset.id });
                });
            });
        }
    };

    // File sharing in chat
    const attachFileBtn = document.getElementById('attachFile');
    const fileInput = document.getElementById('fileInput');
    
    // File sharing configuration
    const FILE_SHARING_CONFIG = {
        maxSize: 50 * 1024 * 1024, // 50MB
        allowedTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'text/csv',
            'application/zip',
            'application/x-rar-compressed'
        ]
    };

    attachFileBtn.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;

        // Check file size
        if (file.size > FILE_SHARING_CONFIG.maxSize) {
            alert(`File size exceeds the limit of ${FILE_SHARING_CONFIG.maxSize / (1024 * 1024)}MB`);
            fileInput.value = ''; // Clear the input
            return;
        }

        // Check file type
        if (!FILE_SHARING_CONFIG.allowedTypes.includes(file.type)) {
            alert('File type not allowed. Please select a supported file type.');
            fileInput.value = ''; // Clear the input
            return;
        }

        // Show loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'file-upload-loading';
        loadingIndicator.innerHTML = `
            <div class="loading-spinner"></div>
            <span>Uploading ${file.name}...</span>
        `;
        document.body.appendChild(loadingIndicator);

        const reader = new FileReader();
        reader.onload = function(e) {
            window.webrtcClient.sendMessage({
                type: 'chat-file',
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                fileData: e.target.result
            });
            // Remove loading indicator
            document.body.removeChild(loadingIndicator);
            fileInput.value = ''; // Clear the input
        };

        reader.onerror = function() {
            alert('Error reading file. Please try again.');
            document.body.removeChild(loadingIndicator);
            fileInput.value = ''; // Clear the input
        };

        reader.readAsDataURL(file);
    });

    // Add styles for loading indicator
    const style = document.createElement('style');
    style.textContent = `
        .file-upload-loading {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 1000;
        }
        .loading-spinner {
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    // Whiteboard panel logic
    const whiteboardBtn = document.getElementById('whiteboardBtn');
    const whiteboardPanel = document.getElementById('whiteboardPanel');
    const closeWhiteboard = document.getElementById('closeWhiteboard');
    const whiteboardCanvas = document.getElementById('whiteboardCanvas');
    const penBtn = document.getElementById('whiteboardPen');
    const eraserBtn = document.getElementById('whiteboardEraser');
    const clearBtn = document.getElementById('whiteboardClear');
    let drawing = false;
    let erasing = false;
    let lastX = 0, lastY = 0;
    let ctx = whiteboardCanvas.getContext('2d');
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#222';

    // Function to resize canvas
    function resizeCanvas() {
        const container = whiteboardCanvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Set canvas size to match container
        whiteboardCanvas.width = rect.width;
        whiteboardCanvas.height = rect.height;
        
        // Scale context to match device pixel ratio
        const dpr = window.devicePixelRatio || 1;
        whiteboardCanvas.style.width = `${rect.width}px`;
        whiteboardCanvas.style.height = `${rect.height}px`;
        whiteboardCanvas.width = rect.width * dpr;
        whiteboardCanvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        
        // Restore drawing settings
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#222';
    }

    // Initial resize and add resize listener
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Update canvas size when panel becomes visible
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                if (whiteboardPanel.classList.contains('active')) {
                    resizeCanvas();
                }
            }
        });
    });
    observer.observe(whiteboardPanel, { attributes: true });

    whiteboardBtn.addEventListener('click', () => {
        whiteboardPanel.classList.add('active');
        resizeCanvas(); // Ensure canvas is properly sized when opened
    });

    closeWhiteboard.addEventListener('click', () => {
        whiteboardPanel.classList.remove('active');
    });

    penBtn.addEventListener('click', () => {
        erasing = false;
        ctx.strokeStyle = document.getElementById('whiteboardColor').value || '#222';
        ctx.lineWidth = parseInt(document.getElementById('whiteboardSize').value) || 3;
    });

    eraserBtn.addEventListener('click', () => {
        erasing = true;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 16;
    });

    clearBtn.addEventListener('click', () => {
        ctx.clearRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
        if (window.sendWhiteboard) window.sendWhiteboard('clear');
    });

    function drawLine(x1, y1, x2, y2, color, width) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    function getCanvasCoords(e) {
        const rect = whiteboardCanvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        let x, y;
        
        if (e.touches) {
            x = (e.touches[0].clientX - rect.left) * (whiteboardCanvas.width / (rect.width * dpr));
            y = (e.touches[0].clientY - rect.top) * (whiteboardCanvas.height / (rect.height * dpr));
        } else {
            x = (e.offsetX !== undefined ? e.offsetX : e.clientX - rect.left) * (whiteboardCanvas.width / (rect.width * dpr));
            y = (e.offsetY !== undefined ? e.offsetY : e.clientY - rect.top) * (whiteboardCanvas.height / (rect.height * dpr));
        }
        return { x, y };
    }

    function handleDrawCoords(x, y) {
        const color = erasing ? '#fff' : document.getElementById('whiteboardColor').value || '#222';
        const width = erasing ? 16 : parseInt(document.getElementById('whiteboardSize').value) || 3;
        drawLine(lastX, lastY, x, y, color, width);
        if (window.sendWhiteboard) {
            window.sendWhiteboard({
                x1: lastX,
                y1: lastY,
                x2: x,
                y2: y,
                color: color,
                width: width
            });
        }
        lastX = x;
        lastY = y;
    }

    // Add event listeners for drawing
    whiteboardCanvas.addEventListener('mousedown', e => { 
        drawing = true; 
        const pt = getCanvasCoords(e); 
        lastX = pt.x; 
        lastY = pt.y; 
    });
    
    whiteboardCanvas.addEventListener('mousemove', e => { 
        if (drawing) { 
            const pt = getCanvasCoords(e); 
            handleDrawCoords(pt.x, pt.y); 
        } 
    });
    
    whiteboardCanvas.addEventListener('mouseup', () => { drawing = false; });
    whiteboardCanvas.addEventListener('mouseout', () => { drawing = false; });
    
    whiteboardCanvas.addEventListener('touchstart', e => { 
        drawing = true; 
        const pt = getCanvasCoords(e); 
        lastX = pt.x; 
        lastY = pt.y; 
    });
    
    whiteboardCanvas.addEventListener('touchmove', e => { 
        if (drawing) { 
            e.preventDefault(); 
            const pt = getCanvasCoords(e); 
            handleDrawCoords(pt.x, pt.y); 
        } 
    }, { passive: false });
    
    whiteboardCanvas.addEventListener('touchend', () => { drawing = false; });

    // Mute all button
    const muteAllBtn = document.getElementById('muteAllBtn');
    if (muteAllBtn) {
        muteAllBtn.addEventListener('click', () => {
            window.webrtcClient.sendMessage({ type: 'mute-all' });
        });
    }
});