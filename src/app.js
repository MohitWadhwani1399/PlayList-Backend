import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();

// Cross Origin Resource Sharing is used to control the FE to which resources from BE can be shared.
app.use(
    cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true,
    })
);

// To accept json data, no need to include bodyParser middleware seperately now(included in express only)
app.use(
    express.json({
        limit: "16kb",
    })
);

//To understand the encoded url
app.use(
    express.urlencoded({
        extended: true,
        limit: "16kb",
    })
);

// To use static files
app.use(express.static("public"));
app.use(cookieParser());

//  routes import
import userRouter from "./routes/user.routes.js";
app.use("/api/v1/users", userRouter);

export { app };
