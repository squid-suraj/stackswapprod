const socket = require("socket.io");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { Chat } = require("../models/chat");
const ConnectionRequest = require("../models/connectionRequest");

const getSecretRoomId = (userId, targetUserId) => {
  return crypto
    .createHash("sha256")
    .update([userId, targetUserId].sort().join("$"))
    .digest("hex");
};

const initializeSocket = (server) => {
  const io = socket(server, {
    cors: {
      origin: "http://localhost:5173",
    },
  });

  io.on("connection", (socket) => {
    socket.on("joinChat", ({ firstName, userId, targetUserId }) => {
      const roomId = getSecretRoomId(userId, targetUserId);
      console.log(`${firstName} joined Room: ${roomId}`);
      socket.join(roomId);
    });

    socket.on(
      "sendMessage",
      async ({ firstName, lastName, userId, targetUserId, text }) => {
        try {
          if (!userId || !targetUserId || !text) {
            console.error(
              "Error: Missing userId, targetUserId, or text in sendMessage"
            );
            return;
          }

          const roomId = getSecretRoomId(userId, targetUserId);
          console.log(`${firstName}: ${text}`);

          const { ObjectId } = mongoose.Types;

          const senderObjectId = new ObjectId(userId);
          const targetObjectId = new ObjectId(targetUserId);

          let chat = await Chat.findOne({
            participants: { $all: [senderObjectId, targetObjectId] },
          });

          if (!chat) {
            chat = new Chat({
              participants: [senderObjectId, targetObjectId],
              messages: [],
            });
          }

          chat.messages.push({
            senderId: senderObjectId,
            text,
            createdAt: new Date(),
          });

          await chat.save();

          io.to(roomId).emit("messageReceived", {
            firstName,
            lastName,
            text,
          });
        } catch (err) {
          console.error("Socket sendMessage error:", err);
        }
      }
    );

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });
};

module.exports = initializeSocket;
