import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

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
    if (!(userName || email)) {
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

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies?.refreshToken || req.body?.refreshToken;
    if (!incomingRefreshToken) throw new ApiError(401, "Unauthorized request!");
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );
        const user = await User.findById(decodedToken?._id);
        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token");
        }
        if (decodedToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh Token is expired");
        }
        const options = {
            httpOnly: true,
            secure: true,
        };
        const { accessToken, newRefreshToken } =
            await generateAccessAndRefreshToken(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access Token Refreshed SuccessfullyP"
                )
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
        throw new ApiError(401, "Incorrect old Password!");
    }
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password Changed Successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(200, req?.user, "Current User Fetched Successfully")
        );
});

const updateAccountDetail = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;
    if (!fullName || !email) {
        throw new ApiError(401, "Fullname or email is required");
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email,
            },
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Account Details Changed Successfully")
        );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing");
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar) {
        throw new ApiError(400, "Error while uploading on cloudinary!");
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar?.url,
            },
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar update successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover Image file is missing");
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImage) {
        throw new ApiError(400, "Error while uploading on cloudinary!");
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: avatar?.url,
            },
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Cover Image update successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req?.params;
    if (!username?.trim()) {
        throw new ApiError(400, "Username is missing");
    }
    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase(),
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscribers",
                as: "subscribedTo",
            },
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers",
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo",
                },
                isSubscribed: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$subscribers.subscriber"],
                        },
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
            },
        },
    ]);
    console.log(channel);
    if (!channel?.length) {
        throw new ApiError(400, "Channel does not exist!");
    }
    return res
        .status(200)
        .json(
            new ApiResponse(200, channel[0], "User channel fetched succesfully")
        );
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetail,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
};
