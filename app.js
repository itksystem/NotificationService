const amqp = require('amqplib');
const nodemailer = require('nodemailer');
const axios = require('axios');
const WebSocket = require('ws');

const RABBITMQ_URL = 'amqp://localhost';
const QUEUE_NAME = 'mail';

// Настройка email-транспорта
const transporter = nodemailer.createTransport({
    service: 'gmail', // Можно использовать другой сервис
    auth: {
        user: 'your-email@gmail.com',
        pass: 'your-email-password'
    }
});

// Функция отправки email
async function sendEmail(to, subject, text) {
    try {
        await transporter.sendMail({ from: 'your-email@gmail.com', to, subject, text });
        console.log(`Email отправлен: ${to}`);
    } catch (error) {
        console.error(`Ошибка при отправке email: ${error}`);
    }
}

// Функция отправки SMS (пример через внешний сервис API)
async function sendSMS(phone, message) {
    try {
        // Пример с использованием API сервиса отправки SMS
        await axios.post('https://sms-service.com/send', {
            phone,
            message
        });
        console.log(`SMS отправлено: ${phone}`);
    } catch (error) {
        console.error(`Ошибка при отправке SMS: ${error}`);
    }
}

// Функция отправки сообщения через WebSocket
function sendWebSocketMessage(socketUrl, message) {
    const ws = new WebSocket(socketUrl);
    ws.on('open', () => {
        ws.send(message);
        console.log(`Сообщение отправлено через WebSocket: ${socketUrl}`);
        ws.close();
    });
    ws.on('error', (error) => {
        console.error(`Ошибка WebSocket: ${error}`);
    });
}

// Основная функция для обработки сообщения из очереди
async function processMessage(msg) {
    const messageContent = JSON.parse(msg.content.toString());
    const { route, to, subject, text } = messageContent;

    switch (route) {
        case 'mail':
            await sendEmail(to, subject, text);
            break;
        case 'sms':
            await sendSMS(to, text);
            break;
        case 'websocket':
            sendWebSocketMessage(to, text);
            break;
        default:
            console.error(`Неизвестный маршрут: ${route}`);
    }
}

// Подключение к RabbitMQ и прослушивание очереди
async function startConsumer() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        console.log(`Ожидание сообщений в очереди ${QUEUE_NAME}...`);

        channel.consume(QUEUE_NAME, async (msg) => {
            if (msg !== null) {
                await processMessage(msg);
                channel.ack(msg); // Подтверждение обработки сообщения
            }
        });
    } catch (error) {
        console.error(`Ошибка подключения к RabbitMQ: ${error}`);
    }
}

startConsumer();
