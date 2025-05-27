document.getElementById('createRoom').addEventListener('click', () => {
    const userName = document.getElementById('userName').value.trim();
    const password = document.getElementById('roomPassword').value.trim();
    if (!userName) {
        alert('Please enter your name');
        return;
    }
    const roomId = Math.random().toString(36).substring(7);
    let url = `/room/${roomId}?name=${encodeURIComponent(userName)}`;
    if (password) url += `&password=${encodeURIComponent(password)}`;
    window.location.href = url;
});

document.getElementById('joinRoom').addEventListener('click', () => {
    const userName = document.getElementById('userName').value.trim();
    const roomId = document.getElementById('roomId').value.trim();
    const password = document.getElementById('roomPassword').value.trim();
    
    if (!userName) {
        alert('Please enter your name');
        return;
    }
    if (!roomId) {
        alert('Please enter a room ID');
        return;
    }
    let url = `/room/${roomId}?name=${encodeURIComponent(userName)}`;
    if (password) url += `&password=${encodeURIComponent(password)}`;
    window.location.href = url;
});

document.getElementById('roomId').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('joinRoom').click();
    }
});

document.getElementById('copyIp').addEventListener('click', () => {
    const ip = document.getElementById('clientIp').textContent;
    navigator.clipboard.writeText(ip).then(() => {
        alert('IP address copied to clipboard!');
    });
});

const showPassword = document.getElementById('showPassword');
const roomPassword = document.getElementById('roomPassword');
if (showPassword && roomPassword) {
    showPassword.addEventListener('change', () => {
        roomPassword.type = showPassword.checked ? 'text' : 'password';
    });
} 