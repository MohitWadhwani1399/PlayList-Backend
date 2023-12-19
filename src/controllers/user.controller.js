import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    // get user detail from Front End
    // validation details
    // check if user already exists : username,email
    // check for images,avatar
    // upload them to cloudinary, check
    // create user object - create entry in db
    // remove passoword and refresh token field from response
    // check for user creation and return res;
    const { fullname, email, username, password } = req.body;
    if (
        [fullname, email, username, password].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All field are required");
    }

    const existedUser = User.findOne({
        $or: [{ email }, { username }],
    });
    if (existedUser) {
        throw new ApiError(409, "User Already Registered");
    }
    console.log(req?.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

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
        fullname,
        avatar: uploadAvatarResponse.url,
        coverImage: uploadCoverImageResponse?.url || "",
        username: username.toLowerCase(),
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

export { registerUser };
