const amqp = require('amqplib');
const nodemailer = require('nodemailer');
const axios = require('axios');
const WebSocket = require('ws');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const promClient = require('prom-client'); //сбор метрик для Prometheus
require('dotenv').config();

const UniversalSender  = require('./helpers/UniversalSender'); // универсальный обработчик сообщений
const sender = new UniversalSender(process.env);



const notificationRouter = require('./routes/notification');
const app = express(); // Создаем приложение Express
app.use(bodyParser.json({ limit: '50mb', extended: true }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));


const PORT = process.env.PORT || 3000;
//  метрика Prometheus
const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Продолжительность HTTP-запросов в секундах',
    labelNames: ['method', 'status', 'path'],
  });
// следим за метриками
app.use((req, res, next) => {
    const end = httpRequestDuration.startTimer({ method: req.method, path: req.path });
    res.on('finish', () => {
      end({ status: res.statusCode });
    });
    next();
  });
    
  // Подключение маршрутов
app.use('/', notificationRouter);      // вывод страниц 
// Запуск сервера   
app.listen(process.env.PORT, () => {
    console.log(`
      ***********************************************
      * Notification Service running on port ${process.env.PORT}   *
      ***********************************************`);
  });
  
  
