# Instagib3

A browser-based multiplayer first-person shooter inspired by Quake 3, built with Three.js.

## Features

- First-person shooter gameplay with railgun mechanics
- Real-time multiplayer via WebSockets
- 3D rendering with Three.js
- Room-based matchmaking

## Requirements

- Node.js

## Running

```bash
npm start
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

Set a custom port with the `PORT` environment variable.

## Multiplayer

Players join rooms by appending query parameters to the URL:

```
http://localhost:8080/?name=YourName&room=q3dm17&color=red
```

- `name` — player name (alphanumeric, max 32 chars)
- `room` — room name (default: `q3dm17`)
- `color` — player color (default: `yellow`)
