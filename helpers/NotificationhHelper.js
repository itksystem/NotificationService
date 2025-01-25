const amqp = require('amqplib');
const db = require('openfsm-database-connection-producer');
const { v4: uuidv4 } = require('uuid'); // Убедитесь, ч
// то установлен uuid версии 8
const SQL = require('common-notification-service').SQL;
const MESSAGES = require('common-notification-service').MESSAGES;
const LANGUAGE = 'RU';
const logger = require('openfsm-logger-handler');

require('dotenv').config();

  exports.getProductMail = async (productId) => {
    const result = await new Promise((resolve, reject) => {
      db.query(SQL.NOTIFICATION.GET_PRODUCT_MAIL, [productId], (err, result) => {
        if (err) {
          logger.error(err);
          return reject(err);
        }
        resolve(result); // Предполагается, что поле isConfirmed
      });
    });  
   return (result?.rows ? result?.rows: null)
  };

  exports.getProductMailPersonal = async (productId, userId, ownerId) => {
    const result = await new Promise((resolve, reject) => {
      db.query(SQL.NOTIFICATION.GET_PRODUCT_MAIL_PERSONAL, [productId, userId, ownerId], (err, result) => {
        if (err) {
          logger.error(err);
          return reject(err);
        }
        resolve(result); // Предполагается, что поле isConfirmed
      });
    });  
    return (result?.rows ? result?.rows: null)
  };



  exports.getMailImages = async (mailId) => {
    const result = await new Promise((resolve, reject) => {
      db.query(SQL.NOTIFICATION.GET_PRODUCT_MAIL_PERSONAL, [productId, userId, ownerId], (err, result) => {
        if (err) {
          logger.error(err);
          return reject(err);
        }
        resolve(result); // Предполагается, что поле isConfirmed
      });
    });  
    return (result?.rows ? result?.rows: null)
  };



  exports.setProductMail =  async (productId, userId, message, toUserId) => {
    let result = db.query( SQL.NOTIFICATION.SET_PRODUCT_MAIL, [productId, userId, message, toUserId, message], (err, result) => {
        if (err) {
          logger.error(err);
          return reject(err);
        }
        resolve(result); // Предполагается, что поле isConfirmed
      });    
    return (result?.rows?.id ? result?.rows[0].id: null)    
  };


  exports.setMailImage = async (mailId, mediaId, mediaKey, productId, userId, storage, bucket) => {
    let result  = db.query(SQL.NOTIFICATION.SET_MAIL_IMAGE, 
	    [mailId, mediaId, mediaKey, productId, userId, storage, bucket ], (err, result) => {
      if (err) {
        logger.error(err);
        return reject(err);
      }
      resolve(result); // Предполагается, что поле isConfirmed
    });    
  return (result?.rows?.id ? result?.rows[0].id: null)    
  };

