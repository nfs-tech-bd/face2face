# WebRTC Meet

A peer-to-peer video conferencing application built with Python FastAPI and WebRTC.

## Features

- Create and join virtual meeting rooms
- Real-time video/audio streaming
- Screen sharing
- Text chat
- Mute audio/video controls
- Copy room ID to clipboard
- Responsive design for mobile devices

## Prerequisites

- Python 3.8+
- pip (Python package manager)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/webrtc-meet.git
cd webrtc-meet
```

2. Create a virtual environment (optional but recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the Application

1. Start the server:
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

2. Open your browser and navigate to:
```
http://localhost:8000
```

## Usage

1. On the home page, either:
   - Click "Create New Room" to start a new meeting
   - Enter a Room ID and click "Join Room" to join an existing meeting

2. Allow camera and microphone access when prompted

3. In the meeting room:
   - Use the control buttons to toggle audio/video
   - Click the screen share button to share your screen
   - Use the chat button to open the text chat panel
   - Click "Leave Room" to end the meeting

## STUN/TURN Server Setup

By default, the application uses Google's public STUN servers. For production use, you should set up your own STUN/TURN servers:

1. Install and configure [coturn](https://github.com/coturn/coturn)

2. Update the ICE servers configuration in `static/js/webrtc.js`:
```javascript
this.config = {
    iceServers: [
        { urls: 'stun:your-stun-server:3478' },
        {
            urls: 'turn:your-turn-server:3478',
            username: 'your-username',
            credential: 'your-password'
        }
    ]
};
```

## Security Considerations

- The application uses WebSocket for signaling without authentication
- For production use, implement:
  - User authentication
  - Room access control
  - HTTPS
  - Secure WebSocket (wss://)
  - Rate limiting
  - Input validation

## Browser Support

Tested and working in:
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## License

MIT License 