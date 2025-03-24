const nodemailer = require('nodemailer');
const amqp = require('amqplib');
const axios = require('axios');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '.env-notification-service' });
const { parseStringPromise } = require('xml2js');

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
            host: config.RABBITMQ_HOST || process.env.RABBITMQ_HOST,
            port: config.RABBITMQ_PORT || process.env.RABBITMQ_PORT,
            user: config.RABBITMQ_USER || process.env.RABBITMQ_USER,
            password: config.RABBITMQ_PASSWORD || process.env.RABBITMQ_PASSWORD,
            
            sms_login: config.SMS_LOGIN || process.env.SMS_LOGIN,
            sms_password: config.SMS_PASSWORD || process.env.SMS_PASSWORD,
            sender_name: config.SMS_SENDER || process.env.SMS_SENDER,

            queue: config.RABBITMQ_QUEUE || process.env.RABBITMQ_QUEUE,
            codes_queue : config.RABBITMQ_CODES_QUEUE || process.env.RABBITMQ_CODES_QUEUE,
            codes_reply_queue : config.RABBITMQ_CODES_REPLY_QUEUE || process.env.RABBITMQ_CODES_REPLY_QUEUE,
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
        this.connection = null;
        this.channel = null;
        this.sync = false;
        this.correlationId = null;
        
        this.startCommonConsumer();
        this.startCopnfirmationCodesConsumer();
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

        // Отправка кодов SMS
        /*
{
"transport" : "code",
"requestId" : "afab9669-8ab0-4187-8c56-854a64f82d3b",
"phone" : "79144042957",
"code" :  23456
}
        */
 // Добавьте в зависимости

async sendCode(message) {
    try {
        if (!message?.phone || !message?.code || !message?.requestId) {
            throw new Error('Не указан телефон или код подтверждения');
        }

        const { sms_password, sms_login, sender_name } = this.rabbitConfig;
        const text = encodeURIComponent(`Код подтверждения: ${message.code}`);
        const url = `https://ssl.bs00.ru/?method=push_msg&email=${sms_login}&password=${sms_password}&text=${text}&phone=${message.phone}&sender_name=${sender_name}`;
        
        console.log(`Отправка SMS на ${message.phone}`); // Безопасное логирование
        
        const response = await axios.post(url);
        
        // Парсим XML ответ
        const parsedResponse = await parseStringPromise(response.data, {
            explicitArray: false,
            ignoreAttrs: true
        });

        // Проверяем наличие ошибок
        const errorCode = parsedResponse?.response?.msg?.err_code;
        if (errorCode !== '0') {
            const errorText = parsedResponse?.response?.msg?.text || 'Unknown error';
            throw new Error(`SMS API error: ${errorText} (code: ${errorCode})`);
        }

        // Извлекаем полезные данные
        const smsData = {
            id: parsedResponse?.response?.data?.id,
            credits: parsedResponse?.response?.data?.credits,
            smsCount: parsedResponse?.response?.data?.n_raw_sms,
            senderName: parsedResponse?.response?.data?.sender_name
        };

        console.log(`SMS успешно отправлено. ID: ${smsData.id}, Использовано кредитов: ${smsData.credits}`);
        
        return { 
            success: true, 
            requestId : message?.requestId, 
            status : "SENDED",
            data: smsData
        };
        
    } catch (error) {
        console.error(`Ошибка при отправке SMS: ${error.message}`);
        
        // Возвращаем структурированную ошибку
        return { 
            success: false, 
            requestId : message?.requestId, 
            status : "ERROR",
            error: {
                message: error.message,
                code: error.response?.status || 'UNKNOWN_ERROR'
            }
        };
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
            console.log(msg)
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
                case 'code':
                    await this.sendCode(messageContent);
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

          // Метод для создания соединения
  async createConnection() {
    try {      
      this.connection = await amqp.connect(`amqp://${this.rabbitConfig.user}:${this.rabbitConfig.password}@${this.rabbitConfig.host}:${this.rabbitConfig.port}`);
      this.channel = await this.connection.createChannel();      
    } catch (err) {
      console.log('Error creating AMQP connection:', err);
      throw err;
    }
  }

  // Метод для закрытия соединения
  async closeConnection() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch (err) {
      console.log('Error closing AMQP connection:', err);
      throw err;
    }
  }

    async sendMessage(queue, msg) {
        try {
          if (!this.channel) await this.createConnection();
          await this.channel.assertQueue(queue, { durable: true });
          const options = this.sync ? { expiration: '60000' } : null;
          await this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(msg)), options);
          console.log(`Message sent to queue "${queue}"`);
          console.log(`${msg}`);
        } catch (err) {
          console.log('Error sending message:', err);      
        } finally {
          
        }
      }

async startConsumer(queue, handler) {
    try {
        if (!this.channel) await this.createConnection();        
        await this.channel.assertQueue(queue, { durable: true });
        console.log(`Listening on queue ${queue}...`);
        this.channel.consume(queue, async (msg) => {
            if (msg) {
                try {
                    const data = JSON.parse(msg.content.toString());
                    await handler(data);
                    this.channel.ack(msg);
                } catch (error) {
                    console.error(`Error processing message: ${error}`);
                }
            }
        });
    } catch (error) {
        console.error(`Error connecting to RabbitMQ: ${error}`);
    }
  }

  
  // Запуск общего  потребителя RabbitMQ
   async startCommonConsumer() {
        await this.startConsumer( this.rabbitConfig.queue, async (msg)=>{
            await this.processing(msg);
        })      
   }

  // Запуск  потребителя результатов кодов подтверждания RabbitMQ
    async startCopnfirmationCodesConsumer() {
       await  this.startConsumer( this.rabbitConfig.codes_queue, async (msg)=>{
            let result = await this.sendCode(msg);            
                await this.sendMessage(this.rabbitConfig.codes_reply_queue, { requestId:result?.requestId, status : result?.status })
                console.log(`Отправлен ответ в ${this.rabbitConfig.codes_reply_queue}`,{ requestId:result?.requestId, status : result?.status })
        })            
   }
}

module.exports = UniversalSender;

