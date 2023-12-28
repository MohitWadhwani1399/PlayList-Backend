import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findOne({ userId });
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generate refresh and access token!"
        );
    }
};
const registerUser = asyncHandler(async (req, res) => {
    // get user detail from Front End
    // validation details
    // check if user already exists : username,email
    // check for images,avatar
    // upload them to cloudinary, check
    // create user object - create entry in db
    // remove passoword and refresh token field from response
    // check for user creation and return res;
    const { fullName, email, userName, password } = req.body;
    if (
        [fullName, email, userName, password].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All field are required");
    }

    const existedUser = await User.findOne({
        $or: [{ email }, { userName }],
    });
    if (existedUser) {
        throw new ApiError(409, "User Already Registered");
    }
    console.log(req?.files);
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    let coverImageLocalPath;
    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }
    if (!avatarLocalPath) {
        return new ApiError(400, "Avatar is required");
    }
    const uploadAvatarResponse = await uploadOnCloudinary(avatarLocalPath);
    const uploadCoverImageResponse =
        await uploadOnCloudinary(coverImageLocalPath);
    console.log(uploadCoverImageResponse);
    if (!uploadAvatarResponse) {
        return new ApiError(400, "Avatar is required");
    }

    const user = await User.create({
        fullName,
        avatar: uploadAvatarResponse.url,
        coverImage: uploadCoverImageResponse?.url || "",
        email,
        userName: userName.toLowerCase(),
        password,
    });
    console.log(user);
    const createduser = await User.findById(user._id).select(
        "-password -refreshToken"
    );
    if (!createduser) {
        throw new ApiError(
            500,
            "Something went wrong while registering the user"
        );
    }
    return res
        .status(201)
        .json(
            new ApiResponse(200, createduser, "User Registered Successfully")
        );
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, userName, password } = req.body;
    if (!userName || !email) {
        throw new ApiError(400, "UserName or password is required");
    }
    const user = await User.findOne({
        $or: [{ email }, { userName }],
    });
    if (!user) {
        throw new ApiError(404, "User does not registered");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Incorrect Password");
    }
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        user._id
    );
    const loggedInUser = User.findOne(user._id).select(
        "-password -refreshToken"
    );

    const options = {
        // cookie option, can be modified only by server with below options
        httpOnly: true,
        secure: true,
    };
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                "User logged in Successfully"
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    // In order to logout an user we need to delete refresh token from an db and
    // also clear the cookie with an access token
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: { refreshToken: undefined },
        },
        {
            new: true, // return the updated user value
        }
    );
    const options = {
        // cookie option, can be modified only by server with below options
        httpOnly: true,
        secure: true,
    };
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out!"));
});

export { registerUser, loginUser, logoutUser };
