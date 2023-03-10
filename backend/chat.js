const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
        origin: '*',
    }
});
const dotenv = require('dotenv')
dotenv.config()
const mongoose = require('mongoose')
mongoose.set('strictQuery', true);

mongoose.connect(process.env.dbURI)
    .then(() => {
        console.log('Connected to db');
    })
    .catch((error) => {
        console.log(error);
    })
const Chat = require("./models/chatDetails")

io.on('connection', (socket) => {
    console.log('Connection made');
    socket.on('join', async (data) => {
        let room = await Chat.findOne({ $and: [{ user1: { $in: [data.sender, data.receiver] } }, { user2: { $in: [data.sender, data.receiver] } }] })
        if (!room) {
            const chat = new Chat({
                user1: data.sender,
                user2: data.receiver,
                messages: []
            })
            room = await chat.save()
        }
        socket.join(room._id.str)
        console.log(`${data.sender} joined ${room._id}`);
        socket.broadcast.to(room._id.str).emit('userJoined', { sender: data.sender, receiver: data.receiver, message: data.message })
    });

    socket.on('leave', async (data) => {
        const room = await Chat.findOne({ $and: [{ user1: { $in: [data.sender, data.receiver] } }, { user2: { $in: [data.sender, data.receiver] } }] })
        socket.leave(room._id.str)
        console.log(`${data.sender} left ${room._id}`);
        socket.broadcast.to(room._id.str).emit('userLeft', { sender: data.sender, receiver: data.receiver, message: 'has left this room.' })
    });

    socket.on('message', async (data) => {
        const room = await Chat.findOne(
            { $and: [{ user1: { $in: [data.sender, data.receiver] } }, { user2: { $in: [data.sender, data.receiver] } }] })
        console.log(`${data.sender} said ${data.message} in ${room._id}`);
        io.in(room._id.str).emit('messageReceived', { sender: data.sender, receiver: data.receiver, message: data.message })
        await Chat.updateOne(
            { _id: room._id },
            {
                $push:
                {
                    messages: { sender: data.sender, message: data.message }
                }
            }
        )
    });
});
server.listen(process.env.PORT, () => {
    console.log(`listening on :${process.env.PORT} for socket connection event`);
});

