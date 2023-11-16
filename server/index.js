import express from "express";
import logger from "morgan";
import dotenv from "dotenv";
import { createClient } from "@libsql/client";

import { Server } from "socket.io";
import { createServer } from "node:http";

dotenv.config();
const port = process.env.port ?? 3001;

const app = express();
const server = createServer(app)
const io = new Server(server, {
    connectionStateRecovery: {
        maxDisconnectionDuration: 10000
    }
})

//create database connection
const db = createClient({
    url: "libsql://flying-mister-sinister-ansonylopez.turso.io",
    authToken: process.env.DB_TOKEN
})

await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT,
        username TEXT
    )
`)


io.on('connection', async (socket) => {
    console.log('a user connected')

    socket.on('disconnect', () => {
        console.log('user disconnected')
    })

    socket.on('chat message', async (msg) => {
        console.log('message: ' + msg)
        let result
        const username = socket.handshake.auth.username ?? 'anonymous'
        try {

            result = await db.execute({
                sql: 'INSERT INTO messages (content, username) VALUES (:msg, :username)',
                args: {msg, username}
            })
        } catch (e) {
            console.error(e)
            return
        }
        
        io.emit('chat message', msg, result.lastInsertRowid.toString(), username)
    })

    if (!socket.recovered) {
        try {
            const results = await db.execute({
                sql: 'SELECT id, content, username FROM messages WHERE id > ?',
                args: [ socket.handshake.auth.serverOffset ?? 0 ]
            })

            results.rows.forEach((row) => {
                socket.emit('chat message', row.content, row.id.toString(), row.username)
            })

        } catch (error) {
            console.error(error)
            return
        }
    }
})


app.use(logger('dev'))

app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/client/index.html');
});


server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
