    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['"Exo 2"', 'sans-serif'],
                    },
                    colors: {
                        neon: {
                            primary: '#7f5af0',
                            secondary: '#2cb67d',
                            accent: '#0ea5e9',
                            pink: '#e94584',
                            dark: '#16161a',
                            light: '#fffffe',
                            gray: '#94a1b2'
                        }
                    },
                    animation: {
                        'float': 'float 6s ease-in-out infinite',
                        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                        'neon-glow': 'neon-glow 1.5s ease-in-out infinite alternate',
                        'background-pan': 'background-pan 15s linear infinite'
                    },
                    keyframes: {
                        float: {
                            '0%, 100%': { transform: 'translateY(0)' },
                            '50%': { transform: 'translateY(-10px)' },
                        },
                        'neon-glow': {
                            '0%': { 'text-shadow': '0 0 5px #7f5af0, 0 0 10px #7f5af0, 0 0 15px #7f5af0' },
                            '100%': { 'text-shadow': '0 0 10px #7f5af0, 0 0 20px #7f5af0, 0 0 30px #7f5af0' },
                        },
                        'background-pan': {
                            '0%': { 'background-position': '0% center' },
                            '100%': { 'background-position': '200% center' },
                        }
                    }
                }
            }
        }
    </script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;500;600;700&display=swap');
        
        body {
            background-color: #16161a;
            color: #fffffe;
            overflow-x: hidden;
        }
        
        .glass-card {
            background: rgba(30, 30, 40, 0.6);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(127, 90, 240, 0.2);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        
        .neon-input {
            background: rgba(20, 20, 25, 0.7);
            border: 1px solid rgba(127, 90, 240, 0.3);
            transition: all 0.3s ease;
            color: #fffffe;
        }
        
        .neon-input:focus {
            border-color: rgba(127, 90, 240, 0.8);
            box-shadow: 0 0 0 2px rgba(127, 90, 240, 0.3);
            background: rgba(20, 20, 25, 0.9);
        }
        
        .primary-btn {
            background: linear-gradient(135deg, #7f5af0 0%, #2cb67d 70%);
            background-size: 200% auto;
            position: relative;
            overflow: hidden;
            color: #fffffe;
            transition: all 0.3s ease;
        }
        
        .primary-btn:hover {
            background-position: right center;
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(127, 90, 240, 0.3);
        }
        
        .secondary-btn {
            background: rgba(30, 30, 40, 0.6);
            border: 1px solid rgba(127, 90, 240, 0.3);
            transition: all 0.3s ease;
        }
        
        .secondary-btn:hover {
            background: rgba(127, 90, 240, 0.1);
            border: 1px solid rgba(127, 90, 240, 0.6);
        }
        
        .neon-text {
            text-shadow: 0 0 8px rgba(127, 90, 240, 0.5);
        }
        
        .floating-shapes {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            opacity: 0.1;
        }
        
        .shape {
            position: absolute;
            border-radius: 50%;
            filter: blur(40px);
        }
        
        .shape-1 {
            width: 400px;
            height: 400px;
            background: #7f5af0;
            top: 10%;
            left: 5%;
            animation: float 20s ease-in-out infinite;
        }
        
        .shape-2 {
            width: 300px;
            height: 300px;
            background: #2cb67d;
            top: 70%;
            left: 20%;
            animation: float 25s ease-in-out infinite reverse;
        }
        
        .shape-3 {
            width: 250px;
            height: 250px;
            background: #0ea5e9;
            top: 20%;
            left: 80%;
            animation: float 30s ease-in-out infinite;
        }
        
        .shape-4 {
            width: 350px;
            height: 350px;
            background: #e94584;
            top: 60%;
            left: 60%;
            animation: float 35s ease-in-out infinite reverse;
        }
        
        /* Password strength meter styles */
        .strength-meter {
            height: 3px;
            margin-top: 8px;
            background: rgba(148, 161, 178, 0.2);
            border-radius: 2px;
            overflow: hidden;
        }
        
        .strength-meter::after {
            content: '';
            display: block;
            height: 100%;
            width: 0;
            background: #2cb67d;
            transition: width 0.3s ease;
        }
        
        .strength-meter.weak::after {
            width: 30%;
            background: #ef4444;
        }
        
        .strength-meter.medium::after {
            width: 60%;
            background: #f59e0b;
        }
        
        .strength-meter.strong::after {
            width: 100%;
            background: #2cb67d;
        }
        
        /* Custom checkbox */
        .custom-checkbox {
            width: 20px;
            height: 20px;
            border: 1px solid #7f5af0;
            border-radius: 4px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .custom-checkbox.checked {
            background-color: #7f5af0;
        }
        
        .custom-checkbox:hover {
            transform: scale(1.05);
        }
        
        
        /* Animated gradient border */
        .gradient-border {
            position: relative;
        }
        
        .gradient-border::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: 8px;
            padding: 2px;
            background: linear-gradient(135deg, #7f5af0, #2cb67d, #0ea5e9);
            -webkit-mask: 
                linear-gradient(#fff 0 0) content-box, 
                linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            pointer-events: none;
            z-index: -1;
        }
    </style>
</head>
<body class="min-h-screen">
    <!-- Floating background shapes -->
    <div class="floating-shapes">
        <div class="shape shape-1"></div>
        <div class="shape shape-2"></div>
        <div class="shape shape-3"></div>
        <div class="shape shape-4"></div>
    </div>
    
    <div class="container mx-auto px-4 py-12">
        <!-- Header -->
        <header class="text-center mb-16">
            <div class="relative inline-block mb-6">
                <div class="absolute inset-0 rounded-full bg-gradient-to-r from-neon-primary via-neon-accent to-neon-secondary blur-lg opacity-70 animate-neon-glow"></div>
                <div class="relative w-24 h-24 rounded-full bg-neon-dark flex items-center justify-center text-neon-light text-3xl shadow-lg">
                    <i class="fas fa-video"></i>
                </div>
            </div>
            <h1 class="text-5xl font-bold mb-3 bg-gradient-to-r from-neon-primary via-neon-accent to-neon-secondary bg-clip-text text-transparent">
                Face2Face
            </h1>
            <p class="text-neon-gray text-lg max-w-md mx-auto">
                Next-generation video conferencing with end-to-end encryption and crystal clear quality
            </p>
        </header>

**Face2Face** is a feature-rich, browser-based video calling platform built using WebRTC and Python. Designed to work seamlessly on local and offline networks, it enables peer-to-peer video conferencing without relying on third-party services or cloud signaling.

---

## 🌟 Features

- ✅ Peer-to-peer video calls (WebRTC)
- ✅ Local and offline network support
- ✅ Mute audio / disable video toggles
- ✅ Screen sharing
- ✅ Participant management (host controls, mute all)
- ✅ Chat panel with file sharing
- ✅ Whiteboard collaboration
- ✅ Call recording indicator
- ✅ Meeting timer
- ✅ Copyable room links
- ✅ Modern and responsive UI

---

## 🚀 Getting Started

### Prerequisites

- Python 3.7+
- pip

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/face2face.git
cd face2face
