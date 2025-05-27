import os
from typing import Dict, Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import json
import secrets
from datetime import datetime
import ssl
import uvicorn
import logging
import asyncio
import socket

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

def get_local_ip():
    """Get the local IP address of the machine"""
    try:
        # Create a socket to get local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))  # Doesn't actually send any data
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "127.0.0.1"

# Store active connections and rooms
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        self.room_participants: Dict[str, Set[str]] = {}
        self.connection_status: Dict[str, Dict[str, bool]] = {}
        self.user_names: Dict[str, Dict[str, str]] = {}  # Store user names
        self.room_start_time: Dict[str, float] = {}  # Store meeting start time per room
        self.room_passwords: Dict[str, str] = {}  # Store room passwords
        self.room_hosts: Dict[str, Set[str]] = {}  # Store host client_ids per room
        self.participant_hosts: Dict[str, Set[str]] = {}  # room_id -> set of host client_ids

    async def connect(self, websocket: WebSocket, room_id: str, client_id: str, user_name: str):
        await websocket.accept()
        logger.info(f"New connection: room_id={room_id}, client_id={client_id}, name={user_name}")
        
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}
            self.room_participants[room_id] = set()
            self.connection_status[room_id] = {}
            self.user_names[room_id] = {}
            self.room_start_time[room_id] = datetime.now().timestamp()
        
        self.active_connections[room_id][client_id] = websocket
        self.room_participants[room_id].add(client_id)
        self.connection_status[room_id][client_id] = True
        self.user_names[room_id][client_id] = user_name
        
        if room_id not in self.participant_hosts:
            self.participant_hosts[room_id] = set()
        if not self.participant_hosts[room_id]:
            self.participant_hosts[room_id].add(client_id)
        
        # Log current room state
        logger.info(f"Room {room_id} state after connection:")
        logger.info(f"- Participants: {self.room_participants[room_id]}")
        logger.info(f"- Active connections: {list(self.active_connections[room_id].keys())}")
        
        # Notify the new user about current participants
        current_participants = {
            client_id: self.user_names[room_id][client_id]
            for client_id in self.room_participants[room_id]
        }
        logger.info(f"Sending room info to {client_id} with participants: {current_participants}")
        await websocket.send_json({
            "type": "room-info",
            "participants": current_participants,
            "meetingStartTime": self.room_start_time[room_id]
        })
        
        # Notify others about the new participant
        await self.broadcast_to_room(
            room_id,
            {
                "type": "user-joined",
                "client_id": client_id,
                "user_name": user_name,
                "timestamp": datetime.now().isoformat()
            },
            exclude_client=client_id
        )

    def disconnect(self, room_id: str, client_id: str):
        logger.info(f"Disconnecting: room_id={room_id}, client_id={client_id}")
        if room_id in self.active_connections:
            self.active_connections[room_id].pop(client_id, None)
            self.room_participants[room_id].discard(client_id)
            self.connection_status[room_id].pop(client_id, None)
            self.user_names[room_id].pop(client_id, None)
            
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
                del self.room_participants[room_id]
                del self.connection_status[room_id]
                del self.user_names[room_id]
                logger.info(f"Room {room_id} is now empty and removed")
            else:
                logger.info(f"Room {room_id} participants after disconnect: {self.room_participants[room_id]}")

    async def broadcast_to_room(self, room_id: str, message: dict, exclude_client: str = None):
        if room_id in self.active_connections:
            for client_id in list(self.active_connections[room_id].keys()):  # Use list() to copy keys
                if client_id != exclude_client:
                    try:
                        await self.active_connections[room_id][client_id].send_json(message)
                        logger.debug(f"Message sent to client {client_id}: {message['type']}")
                    except Exception as e:
                        logger.error(f"Error sending message to client {client_id}: {str(e)}")
                        # Mark client as disconnected and clean up
                        self.connection_status[room_id][client_id] = False
                        await self.handle_disconnection(room_id, client_id)

    async def handle_disconnection(self, room_id: str, client_id: str):
        """Handle cleanup when a client disconnects unexpectedly"""
        logger.info(f"Handling disconnection for client {client_id} in room {room_id}")
        self.disconnect(room_id, client_id)
        try:
            await self.broadcast_to_room(
                room_id,
                {
                    "type": "user-left",
                    "client_id": client_id,
                    "timestamp": datetime.now().isoformat(),
                    "participants": list(self.get_participants(room_id))
                }
            )
        except Exception as e:
            logger.error(f"Error broadcasting disconnect message: {str(e)}")

    def get_participants(self, room_id: str) -> Set[str]:
        return self.room_participants.get(room_id, set())

manager = ConnectionManager()

@app.get("/")
async def get_home(request: Request):
    client_ip = request.client.host
    return templates.TemplateResponse("index.html", {
        "request": request,
        "client_ip": client_ip
    })

@app.get("/room/{room_id}")
async def get_room(request: Request, room_id: str, name: str = None, password: str = None):
    if not name:
        return templates.TemplateResponse("index.html", {
            "request": request,
            "client_ip": request.client.host,
            "error": "Please enter your name to join the room"
        })
    # Password protection
    if room_id not in manager.room_passwords:
        # Room creation: set password if provided
        if password:
            manager.room_passwords[room_id] = password
        else:
            manager.room_passwords[room_id] = ''  # Explicitly set to empty string
    # Room join: check password if set
    if manager.room_passwords[room_id]:
        if not password or password != manager.room_passwords[room_id]:
            return templates.TemplateResponse("index.html", {
                "request": request,
                "client_ip": request.client.host,
                "error": "Incorrect or missing room password."
            })
    local_ip = get_local_ip()
    is_host = False
    if room_id not in manager.room_hosts:
        is_host = True
    return templates.TemplateResponse("room.html", {
        "request": request,
        "room_id": room_id,
        "client_id": secrets.token_urlsafe(6),
        "user_name": name,
        "local_ip": local_ip,
        "is_host": is_host
    })

@app.websocket("/ws/{room_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_id: str):
    try:
        # Multiple hosts logic
        query_params = dict(websocket.query_params)
        user_name = query_params.get('name', 'Anonymous')
        is_host = False
        if room_id not in manager.room_hosts:
            manager.room_hosts[room_id] = set()
        if not manager.room_hosts[room_id]:
            manager.room_hosts[room_id].add(client_id)
            is_host = True
        await manager.connect(websocket, room_id, client_id, user_name)
        
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                logger.debug(f"Received message from {client_id}: {message['type']}")
                message["sender"] = client_id
                
                # Host controls
                if message["type"] == "kick-user":
                    target_id = message.get("target")
                    if target_id and room_id in manager.active_connections:
                        await manager.active_connections[room_id][target_id].send_json({
                            "type": "kick-user",
                            "target": target_id
                        })
                        await manager.active_connections[room_id][target_id].close()
                        manager.disconnect(room_id, target_id)
                elif message["type"] == "promote-host":
                    target_id = message.get("target")
                    if target_id:
                        manager.participant_hosts[room_id].add(target_id)
                        await manager.active_connections[room_id][target_id].send_json({
                            "type": "promote-host",
                            "target": target_id
                        })
                elif message["type"] == "mute-all":
                    for pid, ws in manager.active_connections[room_id].items():
                        if pid != client_id:
                            await ws.send_json({"type": "mute-all"})
                
                # Handle different message types
                if message["type"] in ["offer", "answer", "ice-candidate"]:
                    target_id = message.get("target")
                    if target_id and room_id in manager.active_connections:
                        if target_id in manager.active_connections[room_id]:
                            try:
                                # Attach user_name to the message
                                message["user_name"] = manager.user_names[room_id].get(client_id, "Unknown")
                                await manager.active_connections[room_id][target_id].send_json(message)
                                logger.debug(f"Forwarded {message['type']} from {client_id} to {target_id}")
                            except Exception as e:
                                logger.error(f"Error forwarding message: {str(e)}")
                                await manager.handle_disconnection(room_id, target_id)
                
                elif message["type"] == "chat":
                    user_name = manager.user_names[room_id].get(client_id, "Unknown")
                    await manager.broadcast_to_room(
                        room_id,
                        {
                            "type": "chat",
                            "sender": client_id,
                            "user_name": user_name,
                            "message": message["message"],
                            "timestamp": datetime.now().isoformat()
                        }
                    )
                elif message["type"] == "chat-file":
                    user_name = manager.user_names[room_id].get(client_id, "Unknown")
                    await manager.broadcast_to_room(
                        room_id,
                        {
                            "type": "chat-file",
                            "sender": client_id,
                            "user_name": user_name,
                            "fileName": message["fileName"],
                            "fileType": message["fileType"],
                            "fileData": message["fileData"],
                            "timestamp": datetime.now().isoformat()
                        }
                    )
                elif message["type"] == "whiteboard-draw":
                    await manager.broadcast_to_room(
                        room_id,
                        {
                            "type": "whiteboard-draw",
                            "x1": message["x1"],
                            "y1": message["y1"],
                            "x2": message["x2"],
                            "y2": message["y2"],
                            "color": message["color"],
                            "width": message["width"]
                        },
                        exclude_client=client_id
                    )
                elif message["type"] == "whiteboard-clear":
                    await manager.broadcast_to_room(
                        room_id,
                        { "type": "whiteboard-clear" },
                        exclude_client=client_id
                    )
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON received from {client_id}: {str(e)}")
            except Exception as e:
                logger.error(f"Error processing message from {client_id}: {str(e)}")
                break
    
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: room_id={room_id}, client_id={client_id}")
        await manager.handle_disconnection(room_id, client_id)
    except Exception as e:
        logger.error(f"Unexpected error in websocket_endpoint: {str(e)}")
        await manager.handle_disconnection(room_id, client_id)

if __name__ == "__main__":
    local_ip = get_local_ip()
    logger.info(f"Server will be available at: https://{local_ip}:8443")
    
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain('cert.pem', 'key.pem')
    
    uvicorn.run(
        app,
        host="0.0.0.0",  # Listen on all interfaces
        port=8443,
        ssl_certfile="cert.pem",
        ssl_keyfile="key.pem",
        log_level="debug"
    ) 