<p align="center"><img src="https://raw.githubusercontent.com/nfs-tech-bd/face2face/refs/heads/main/logo.png" height="300" width="300"></p>


**Face2Face** is a feature-rich, browser-based video calling platform built using WebRTC and Python. Designed to work seamlessly on local and offline networks, it enables peer-to-peer video conferencing without relying on third-party services or cloud signaling.

---

## 🌟 Features

- ✅ Peer-to-peer real-time video calls (WebRTC)
- ✅ Local and offline network support
- ✅ Mute audio / disable video toggles
- ✅ Screen sharing
- ✅ Participant management (host controls, mute all)
- ✅ Text Chat panel with file sharing
- ✅ Whiteboard collaboration
- ✅ Call recording indicator
- ✅ Meeting timer
- ✅ Modern and responsive UI

---

## 🚀 Getting Started

### Prerequisites

- Python 3.7+
- pip

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/nfs-tech-bd/face2face.git
cd face2face
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8443 --ssl-keyfile key.pem --ssl-certfile cert.pem
```

you can access with https://localhost:8443 or your https://<local-ip>:8443

## 🔐 Privacy Focus
- All connections are peer-to-peer (no media passes through a server).

- Works fully offline or on intranet networks.

- No external signaling server required (runs everything locally).


You can also port forward using ngrok and make it visiable everywhere

add your authtoken in config.yml

```bash
ngrok start --config config.yml --all
```

## Browser Support

Tested and working in:
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## License

MIT License 

## 🙌 Contributing
Pull requests are welcome! If you have ideas for new features or improvements, feel free to open an issue or PR.
