const express = require('express');
const initDb = require('./helpers/db').initDb;
const initIo = require('./helpers/socket').initIo;
const app = express();
const bodyParser = require('body-parser');
const helmet = require('helmet');
const fileUpload = require('express-fileupload');
const cors = require("cors");
const xss = require('xss-clean');
const clientURL = require('./utils/URI');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const groupRoutes = require('./routes/groups');
const postRoutes = require('./routes/post');
const usersSockets = require('./sockets/users');
const User = require('./models/user');
const { leaveGroup } = require('./controllers/groups');

// allow CORS
app.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
	res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
	next();
});

app.use(helmet());
app.use(bodyParser.json());
app.use(xss());
app.use(helmet());
app.use(express.json());
app.use(fileUpload({ useTempFiles: true }));
app.use(cors());

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/groups', groupRoutes);
app.use('/api/v1/posts', postRoutes);

// error handler middleware
app.use((error, req, res, next) => {
	console.log('error', error);
	const errorMessage = error.message ? error.message : 'something went wrong';
	const statusCode = error.statusCode ? error.statusCode : 500;
	console.log('statusCode', statusCode);

	res.status(statusCode).json({ error: errorMessage });
});

// initializing the database using native mongoDB driver
initDb((error, client) => {
	if (error) {
		console.log('error', error);
		console.log('Failed To Connect...');
	} else {
		console.log('Connected...');
		let httpServer;
		if (process.env.PORT) {
			console.log('Production');
			httpServer = app.listen(process.env.PORT);
		} else {
			console.log('Development');
			httpServer = app.listen(1502);
		}

		// AGENDA
		// TIME INTERVAL JOBS
		const Agenda = require('agenda');
		const agenda = new Agenda({ mongo: client.db('chatsApp'), db: { collection: 'agenda' } });

		agenda.define('cleanProfileViewers', async (job, done) => {
			await User.updateUsersWithACondition({}, { $set: { profileViewers: [] } });

			done();
		});

		agenda.on('ready', async () => {
			// IIFE to give access to async/await
			await agenda.start();
			await agenda.every('24 hours', 'cleanProfileViewers');

			console.log('working!!!');
		});

		const io = initIo(httpServer);
		// listening to our only namespace => '/'
		// 1- emit,   2- socket.on   3- io.in(room).emit(),
		io.on('connection', socket => {
			console.log('a new user connected')
			socket.on('changeActivityStatusFromClient', data => {
				console.log('changeActivityStatusFromClient')
				usersSockets.changeActivityStatus(data);
			});

			socket.on('leaveRoomOrGroup', data => {
				console.log('leaveRoomOrGroup')
				const { roomId } = data;
				socket.leave(roomId);
			});

			// when the user request his chats
			socket.on('onChats', data => {
				console.log('onChats')
				usersSockets.onChats(data.userToken);
			});

			// when the user joins a room
			socket.on('joinRoom', data => {
				usersSockets.joinChatRoom(socket, data.chatRoomId, data.userToken);
			});

			socket.on('privateMessage', data => {
				console.log('privateMessage')
				usersSockets.sendPrivateMessage(socket, data.messageData, data.userToken);
			});

			socket.on('messageIsSeen', data => {
				console.log('messageSeen')
				usersSockets.messageSeen(socket, data);
			});

			socket.on('typing', data => {
				// data.typing <bool>
				// the frontend will emit this with data.typing = true if the message.length > 0
				// if the user cleared the message(message.length === 0), he will send data.typing = false

				const { userId, isTyping, roomId } = data;

				console.log(socket.rooms);
				// const userChatRoom = Object.keys(socket.rooms)[1];

				io.in(roomId).emit('isTyping', { userId, isTyping });
			});

			socket.on('joinGroupRoom', data => {
				console.log('joinGroupRoom')
				usersSockets.joinGroupRoom(socket, data.groupId, data.userToken);
			});

			socket.on('sendGroupMessage', data => {
				console.log('sendGroupMessage')
				usersSockets.sendGroupMessage(socket, data.messageData, data.userToken);
			});
		});
	}
});
