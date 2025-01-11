const nodemailer = require('nodemailer');
const amqp = require('amqplib');
const axios = require('axios');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');


/*
Модель сообщения 
 {
  "transport": "mail",
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

class UniversalSender {
    constructor(config) {
        // Конфигурация RabbitMQ
        this.rabbitConfig = {
            host: config.RABBITMQ_HOST || 'rabbitmq-service',
            port: config.RABBITMQ_PORT || '5672',
            user: config.RABBITMQ_USER || 'guest',
            password: config.RABBITMQ_PASSWORD || 'guest',
            queue: config.RABBITMQ_QUEUE || 'mail',
        };

        // Конфигурация Email
        this.emailConfig = {
            from: config.MAIL_FROM || 'no-reply@openfsm.ru',
            host: config.MAIL_HOST || 'mailhog',
            port: config.MAIL_PORT || 1025,
            user: config.MAIL_LOGIN || 'test',
            password: config.MAIL_PASSWORD || 'test',
            secure: config.MAIL_SECURY === 'true',
        };

        this.transporter = nodemailer.createTransport({
            host: this.emailConfig.host,
            port: this.emailConfig.port,
            secure: this.emailConfig.secure,
            auth: {
                user: this.emailConfig.user,
                pass: this.emailConfig.password,
            },
        });
        this.startConsumer();
    }

    // Чтение HTML-шаблона
    async readTemplateFile(fileName) {
        try {
            const filePath = path.join(__dirname, 'templates', fileName);
            return await fs.promises.readFile(filePath, 'utf8');
        } catch (error) {
            throw new Error(`Error reading file: ${error.message}`);
        }
    }

    // Замена переменных в шаблоне
    fillTemplate(template, variables) {
        return template.replace(/%\w+%/g, (match) => {
            const varName = match.slice(1, -1); // Убираем символы %
            return varName in variables ? variables[varName] : match;
        });
    }

    // Отправка email
    async sendEmail(to, subject, html, text) {
        try {
            const options = html
                ? { from: this.emailConfig.from, to, subject, html }
                : { from: this.emailConfig.from, to, subject, text };

            await this.transporter.sendMail(options);
            console.log(`Email отправлен: ${to}`);
        } catch (error) {
            console.error(`Ошибка при отправке email: ${error.message}`);
        }
    }

    // Отправка SMS через внешний API
    async sendSMS(phone, message) {
        try {
            await axios.post('https://mts.ru/send', { phone, message });
            console.log(`SMS отправлено: ${phone}`);
        } catch (error) {
            console.error(`Ошибка при отправке SMS: ${error.message}`);
        }
    }

    // Отправка сообщения через WebSocket
    sendWebSocketMessage(socketUrl, message) {
        const ws = new WebSocket(socketUrl);

        ws.on('open', () => {
            ws.send(message);
            console.log(`Сообщение отправлено через WebSocket: ${socketUrl}`);
            ws.close();
        });

        ws.on('error', (error) => {
            console.error(`Ошибка WebSocket: ${error.message}`);
        });
    }

    // Обработка сообщений из очереди
    async processing(msg) {
        try {
            const messageContent = JSON.parse(msg.content.toString());
            const { transport, template, to, subject, text, variables } = messageContent;
            let html;

            if (template) {
                const templateContent = await this.readTemplateFile(`${template}.html`);
                html = this.fillTemplate(templateContent, variables);
            }

            switch (transport.toLowerCase()) {
                case 'mail':
                    await this.sendEmail(to, subject, html, text);
                    break;
                case 'sms':
                    await this.sendSMS(to, text);
                    break;
                case 'websocket':
                    this.sendWebSocketMessage(to, text);
                    break;
                default:
                    console.error(`Неизвестный маршрут: ${route}`);
            }
        } catch (error) {
            console.error(`Ошибка обработки сообщения: ${error.message}`);
        }
    }

    // Запуск потребителя RabbitMQ
    async startConsumer() {
        try {
            const { host, port, user, password, queue } = this.rabbitConfig;
            const connection = await amqp.connect(`amqp://${user}:${password}@${host}:${port}`);
            const channel = await connection.createChannel();
            await channel.assertQueue(queue, { durable: true });

            console.log(`Ожидание сообщений в очереди ${queue}...`);

            channel.consume(queue, async (msg) => {
                if (msg) {
                    await this.processing(msg);
                    channel.ack(msg);
                }
            });
        } catch (error) {
            console.error(`Ошибка подключения к RabbitMQ: ${error.message}`);
        }
    }
}

module.exports = UniversalSender;
