const amqp = require('amqplib');
const nodemailer = require('nodemailer');
const axios = require('axios');
const WebSocket = require('ws');



// Настройка email-транспорта
const transporter = nodemailer.createTransport({
    service: 'yandex', // Можно использовать другой сервис
    host: process.env.MAIL_HOST || "smtp.yandex.ru",
    port: process.env.MAIL_PORT || 465,
    auth: {
        user: process.env.MAIL_LOGIN || "пароль",
        pass: process.env.MAIL_PASSWORD  || "логин"
    }
});

// Функция отправки email
async function sendEmail(to, subject, text) {
    try {
        await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
        console.log(`Email отправлен: ${to}`);
    } catch (error) {
        console.error(`Ошибка при отправке email: ${error}`);
    }
}

// Функция отправки SMS (пример через внешний сервис API)
async function sendSMS(phone, message) {
    try {        
        await axios.post('https://mts.ru/send', {
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
// {"route":"mail", "to":"itk_system@mail.ru", "subject":"subject test", "text":"test"}
// Основная функция для обработки сообщения из очереди
async function processMessage(msg) {
    try {
        let message = msg.content.toString();
        const messageContent = JSON.parse(message);
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
    } catch (error) {
        console.log(`Ошибка ${error}...`);
    }
   
}

// Подключение к RabbitMQ и прослушивание очереди
async function startConsumer() {
    try {
        const { RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_USER, RABBITMQ_PASSWORD, RABBITMQ_QUEUE } = process.env;
        let login =  RABBITMQ_USER || 'guest';
        let pwd =  RABBITMQ_PASSWORD || 'guest';
        let queue = RABBITMQ_QUEUE || 'mail';
        let host = RABBITMQ_HOST || 'localhost';
        let port = RABBITMQ_PORT || '5672';
    
        const connection = await amqp.connect(`amqp://${login}:${pwd}@${host}:${port}`);
        const channel = await connection.createChannel();
        await channel.assertQueue(queue, { durable: true });
        console.log(`Ожидание сообщений в очереди ${queue}...`);

        channel.consume(queue, async (msg) => {
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
