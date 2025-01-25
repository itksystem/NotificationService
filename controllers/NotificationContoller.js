const notificationHelper = require('../helpers/NotificationhHelper');  /* Библиотека с общими параметрами */
const authMiddleware = require('openfsm-middlewares-auth-service');
const logger = require('openfsm-logger-handler');
const { v4: uuidv4 } = require('uuid'); 
const CommonFunctionHelper = require("openfsm-common-functions")
const commonFunction= new CommonFunctionHelper();
const AuthServiceClientHandler = require("openfsm-auth-service-client-handler");
const authClient = new AuthServiceClientHandler();              // интерфейс для  связи с MC AuthService
const WarehouseServiceClientHandler   = require('openfsm-warehouse-service-client-handler');
const warehouseClient   = new WarehouseServiceClientHandler();


require('dotenv').config();


const sendResponse = (res, statusCode, data) => {
    if(statusCode >= 400)
    logger.error(data);
    res.status(statusCode).json(data);
};

exports.getProductMail = async (req, res) => {          
    try {
		let userId = await authClient.getUserId(req, res);
        if(!userId) throw(401)     
        let productId = req.params.productId;
        if(!productId) throw(422);               
        let filterId = req.query.id;
		console.log(productId, userId, filterId); 

		const response = await warehouseClient.getProductById(commonFunction.getJwtToken(req), productId);
		if (!response.success)  throw(response?.status || 500)

		let ownerId = response.data?.ownerId; // Пишем владельцу товара
        let mails =(!filterId)
	 		? await notificationHelper.getProductMail(productId)
	 		: await notificationHelper.getProductMailPersonal(productId, filterId, ownerId);

         mails.filterId=filterId;

	    const itemsWithMedia = await Promise.all( // Асинхронно загружаем медиафайлы для каждого продукта
	    mails?.map(async (item) => {
	        try { // Загружаем медиафайлы для продукта          
	          let mediaTtems = await notificationHelper.getMailImages(item.id); 
			  if(item.user_id==userId) item.self = true;
	    	      item.mediaFiles=[];
	  	  			await Promise.all( // Асинхронно загружаем медиафайлы для каждого продукта
		    			mediaTtems.map(async (image) => {
		        			try { // Загружаем медиафайлы для продукта          
			  				   console.log(image);
 	          			       item.mediaFiles.push({ url : image.media_key, file_id: image.media_id});
	        				 } catch (mediaError) { // Логируем ошибку загрузки медиафайлов, но продолжаем обработку других продуктов          
					            logger.error(mediaError.message);
		    			        console.error(`Error fetching media for product_id ${item.productId}: ${mediaError.message}`);
	        	  			item.media = [];  // Если ошибка загрузки медиафайлов, оставляем пустой массив
		        			}
	        	return item;
		      })	
		    );    
        } catch (mediaError) { // Логируем ошибку загрузки медиафайлов, но продолжаем обработку других продуктов          
          logger.error(mediaError.message);
          console.error(`Error fetching media for product_id ${item.productId}: ${mediaError.message}`);
          item.media = [];  // Если ошибка загрузки медиафайлов, оставляем пустой массив
        }
       	return item;
      })	
    );    
    sendResponse(res, 200, { status: true, mails});	
  } catch (error) {
    logger.error(error.message);
    sendResponse(res, (Number(error) || 500), { code: (Number(error) || 500), message:  new CommonFunctionHelper().getDescriptionByCode((Number(error) || 500)) });
  }
};

exports.setProductMail = async (req, res) => {         
    try {
        let userId = await authClient.getUserId(req, res);
        let productId = req.params.productId;
        let {message} = req.body;
        if(!userId || !productId || !message ) {    	    
            logger.error(productId, userId, message);
 	  		throw(422);               
		}
		const response = await warehouseClient.getProductById(commonFunction.getJwtToken(req), productId);
		if (!response.success)  throw(response?.status || 500)
		let ownerId = response.data?.ownerId; // Пишем владельцу товара
		let toUserId = (userId == ownerId && req.userId) ? req.userId : 0; // владелец пишет пользователю

        let {files} = req.body;
        let mailId = await notificationHelper.setProductMail(productId, userId, message, 
			((userId != ownerId) ? ownerId : toUserId)
			);
        // сохраняем изображения
        console.log(files);
  	   if(files?.length > 0) 
  	      await Promise.all( // Асинхронно загружаем медиафайлы для каждого продукта
	    files.map(async(file) => {
	        try { 
		  console.log(file);
		  let storage  = 'pickmax.products';
		  let bucket   = 'local';  
	          let result = await notificationHelper.setMailImage(mailId, file.fileId, file.url, productId, userId, storage, bucket)
	        } catch (mediaError) { // Логируем ошибку загрузки медиафайлов, но продолжаем обработку других продуктов          
	    	  logger.error(mediaError.message);
	          console.error(`Error fetching media for product_id ${productId}: ${mediaError.message}`);
	        }
	      })	
  	   );
        sendResponse(res, 200, { status: true });	
       } catch (error) {
        logger.error(error.message);
        sendResponse(res, (Number(error) || 500), { code: (Number(error) || 500), message:  new CommonFunctionHelper().getDescriptionByCode((Number(error) || 500)) });
    }
};