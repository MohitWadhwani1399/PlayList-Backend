//require('dotenv').config({path:'./env'})
import dotenv from 'dotenv';
import connectDB from "./db/index.js";
import {app} from "./app.js"

dotenv.config({
    path:'./env'
});

const port = process.env.PORT || 8000;

connectDB()
.then(()=>{
    app.listen(port,()=>{
        console.log(`Server running at port ${port}`);
    })
})
.catch(error=>{
    console.log(`Connection to Mongo Failed !!! ${error}`)
})
// import express from "express";
// const app = express();

// // iifys is used to write the code to start the connection with DB 
// ;(async ()=>{
//     try {
//         await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);
//         app.on("error",(error)=>{
//             console.log(`Error: ${error}`);
//             throw error;
//         })
//         app.listen(process.env.PORT,()=>{
//             console.log(`App is listening on port ${process.env.PORT}`);
//         })
//     } catch (error) {
//         console.log(error);
//         throw error;
//     }
// })()