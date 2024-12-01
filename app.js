const amqp = require('amqplib');
const nodemailer = require('nodemailer');
const axios = require('axios');
const WebSocket = require('ws');
require('dotenv').config();



const fs = require('fs');
const path = require('path');

const { RABBITMQ_HOST, RABBITMQ_PORT, RABBITMQ_USER, RABBITMQ_PASSWORD, RABBITMQ_QUEUE,
    MAIL_FROM, MAIL_HOST, MAIL_PORT, MAIL_LOGIN, MAIL_PASSWORD,  MAIL_SECURY 
 } = process.env;

 console.log(process.env);

const login = RABBITMQ_USER || 'guest';
const pwd = RABBITMQ_PASSWORD || 'guest';
const queue = RABBITMQ_QUEUE || 'mail';
const host = RABBITMQ_HOST || 'rabbitmq-service';
const port = RABBITMQ_PORT || '5672';

const mail_from = MAIL_FROM || 'no-reply@openfsm.ru';
const mail_host = MAIL_HOST || "mailhog"
const mail_port = MAIL_PORT || 1025
const mail_login = MAIL_LOGIN || "test"
const mail_password = MAIL_PASSWORD  || "test"
const mail_secure = MAIL_SECURY  || false

// Настройка email-транспорта
const transporter = nodemailer.createTransport({
    host: mail_host,
    port: mail_port,
    secure: mail_secure == 'true' ? true : false,  // локально тестируем - отключили почту
    auth: {
        user: mail_login,
        pass: mail_password
    }
});

/**
  * @param {string} fileName 
 * @returns {Promise<string>} 
 */
async function readTemplateFile(fileName) {
    try {
        const filePath = path.join(__dirname, 'templates', fileName);
        const fileContent = await fs.promises.readFile(filePath, 'utf8');
        return fileContent;
    } catch (error) {
        throw new Error(`Error reading file: ${error.message}`);
    }
}

/**
 * @param {string} template - html шаблон
 * @param {Object} variables - массив с переменными
 * @returns {string} - возвращает контент с текстом
 */
function fillTemplate(template, variables) {
    return template.replace(/%(\w+)%/g, (match, varName) => {
        return varName in variables ? variables[varName] : match;
    });
}

// Функция отправки email
async function sendEmail(to, subject, html, text) {
    try {        
        await transporter.sendMail(
            html 
            ? { from: mail_from, to, subject, html  }
            : { from: mail_from, to, subject, text }
        );
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
/*
Модель сообщения 
 {
  "route": "mail",
  "template": "NEW_USER_NOTIFICATION",
  "to": "itk_system@mail.ru",
  "subject": "Добро пожаловать на PICKMAX.RU - ваш супермаркет в Интернет! ",
  "text": "test",
  "variables": {
    "HOST_NAME": "PICKMAX.RU",
    "HOST": "pickmax.ru"
  }
}
 */
// Основная функция для обработки сообщения из очереди
async function processMessage(msg) {
    try {
        var html;
        let message = msg.content.toString();
        const messageContent = JSON.parse(message);
        const { route, template , to, subject, text, variables } = messageContent;
        console.log(messageContent)
        if(template) {
            html = fillTemplate(await readTemplateFile(template+'.html'), variables)
         }
            
        switch (route) {
            case 'mail':                
                await sendEmail(to, subject, html, text);
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
