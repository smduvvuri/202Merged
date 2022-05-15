const Admin = require('../../Mongo_Schema/admin/adminSchema');

const Hotel = require('../../Mongo_Schema/hotel/hotelSchema');
const Room = require('../../Mongo_Schema/room/roomSchema');
const Book = require('../../Mongo_Schema/booking/bookingSchema');
const responseMessages = require('../../constants/responseMessages');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const mongoose = require('mongoose');
const { read } = require('fs');
const config = require('../../config/config');
const nodemailer = require('nodemailer');
var xoauth2 = require('xoauth2');
const { v4: uuid_v4 } = require('uuid');


const maxAge = 15 * 24 * 60 * 60;



const adminController = {};

// create Sub admin\

const createToken = function (id) {

    console.log('creating token');
    return jwt.sign({ id, isRefreshToken: false }, 'secret', {
        expiresIn: maxAge
    });

}

adminController.signup = async function (req, res) {

    const maxUserId = await Admin.find({},{"userId":1}).sort({_id:-1}).limit(1);
    console.log(maxUserId)
    const nextUserId = ((parseInt(maxUserId[0].userId,10) < 1))?(parseInt(maxUserId[0].userId,10) + 1):1;
    console.log(nextUserId)

    Admin.findOne({ email: req.body.email }).then(function (user) {
        if (user) {
            res.status(responseMessages.userExists.code).json({
                message: responseMessages.userExists.message
            });
        } else {
            bcrypt.hash(req.body.password, 10).then((hash) => {
                const admin = {
                    userId : nextUserId,
                    userName: req.body.name,
                    email: req.body.email,
                    mobileNumber: req.body.mobileNumber,
                    password: hash,
                    type: req.body.type,
                }

                Admin.create(admin).then(function (admin) {
                    const token = createToken(admin._id);
                    res.cookie('jwt', token, { httpOnly: true, maxAge: maxAge * 1000 });
                    res.status(responseMessages.signedUp.code).json({
                        message: responseMessages.signedUp.message,
                        result: admin
                    });
                }).catch(function (err) {
                    console.log(err);
                    res.status(responseMessages.signUpFailed.code).json({
                        message: responseMessages.signUpFailed.message
                    });
                });
            }).catch(function (err) {
                res.status(responseMessages.couldNotGenerateHash.code).json({
                    message: responseMessages.couldNotGenerateHash.message
                });
            });
        }
    }).catch(function (err) {
        res.status(responseMessages.internalError.code).json({
            message: responseMessages.internalError.message
        });
    });

}

adminController.signin = async function (req, res) {

    try{
        const { email, password } = req.body;

        if (!email) {
            res.status(responseMessages.emailRequired.code).json({
                message: responseMessages.emailRequired.message
            });
        } else if (!password) {
            res.status(responseMessages.passwordRequired.code).json({
                message: responseMessages.passwordRequired.message
            })
        } else {
            const admin = await Admin.findOne({ email: email });
            if (!admin) {
                res.status(responseMessages.adminDoesNotExist.code).json({
                    message: responseMessages.adminDoesNotExist.message
                });
            } else {
                const match = await bcrypt.compare(req.body.password, admin.password);
            
                if (match) {
                    const token = createToken(admin._id);
                    admin.token = token;
                    res.cookie('jwt', token, { httpOnly: true, maxAge: maxAge * 1000 });
                    res.status(responseMessages.signedIn.code).json({
                        message: responseMessages.signedIn.message,
                        result: {
                            userId: admin.userId,
                            adminType: admin.type,
                            email: admin.email,
                            _id: admin._id,
                            mobileNumber: admin.mobileNumber,
                            token: token,
                            userName: admin.userName,
                            profileImage: admin.profileImage
                        }
                    });
                } else {
                    res.status(responseMessages.signInFailed.code).json({
                        message: responseMessages.signInFailed.message
                    });
                }
            }
        }
    } catch(err) {
        console.log(err);
        res.status(responseMessages.signInFailed.code).json({
            message: responseMessages.signInFailed.message,
            err: err
        });
    }
}

adminController.getProfile = async function(req,res){
    console.log("Hi there!")
    const profile = await Admin.findOne({userId: req.body.userId});
    if(profile){
        res.status(responseMessages.hotelsFound.code).json({
            message: responseMessages.hotelsFound.message,
            profile:profile,
        });
    }else{
        res.status(responseMessages.hotelsNotFound.code).json({
            message: responseMessages.hotelsNotFound.message,
        });
    }
}

adminController.updateProfile = async function (req, res) {
    try{
        const findProfile = await Admin.findOne({userName:req.body.userName});

        const profile = await Admin.findOneAndUpdate(
            { userName:req.body.userName },
            {
                ...req.body,
            }
        );

        const findProfileToReturn = await Admin.findOne({userName:req.body.userName});

        if (findProfileToReturn) {
            res.status(responseMessages.hotelUpdate.code).json({
                message: responseMessages.hotelUpdate.message,
                res: findProfileToReturn
            });
        }
    }catch(err) {
        console.log(err);
        res.status(responseMessages.hotelUpdateFailed.code).json({
            message: responseMessages.hotelUpdateFailed.message
        });
    }
}


adminController.addHotel = async function (req, res){
    console.log("addHotel")
    const maxHotelNum = await Hotel.find({},{"hotelNumber":1}).sort({_id:-1}).limit(1);
    const nextHotelNum = ((parseInt(maxHotelNum[0].hotelNumber,10) < 1))?(parseInt(maxHotelNum[0].hotelNumber,10) + 1):1;
    try{
        const hotel = {
            hotelNumber: nextHotelNum,
            hotelName: req.body.hotelName,
            hotelDescription: req.body.hotelDescription,
            hotelLocation: req.body.hotelLocation,
            hotelAddress: req.body.hotelAddress,
            hotelImage: req.body.hotelImage,
            breakfast: req.body.breakfast,
            meal: req.body.meal,
            gym: req.body.gym,
            pool: req.body.pool,
            parking: req.body.parking,
            hotelCharge: req.body.hotelCharge,
            weekendCharge: req.body.weekendCharge,
            holidayCharge: req.body.holidayCharge,
            seasonCharge: req.body.seasonCharge,
            extraGuestCharge: req.body.extraGuestCharge
        }

        const hotelCreated = await Hotel.create( hotel );

        const updateHotel = await Hotel.findByIdAndUpdate(
            { _id: hotelCreated._id },
        );
        const updatedData = await Hotel.findOne({ _id: updateHotel._id });

        result = {
            updatedData
        }

        res.status(responseMessages.hotelCreated.code).json({
            message: responseMessages.hotelCreated.message,
            result: result
        });


    } catch(err) {
        console.log(err);
        res.status(responseMessages.hotelCreationFailed.code).json({
            message: responseMessages.hotelCreationFailed.message
        });
    }
}

adminController.updateHotel = async function (req, res) {
    try{
        const findHotel = await Hotel.findOne({hotelName:req.body.hotelName});
        

    
        const hotel = await Hotel.findOneAndUpdate(
            { hotelName:req.body.hotelName },
            {
                ...req.body,
            }
        );
        
        const findHotelToReturn = await Hotel.findOne({hotelName:req.body.hotelName});
        
        if (findHotelToReturn) {
            res.status(responseMessages.hotelUpdate.code).json({
                message: responseMessages.hotelUpdate.message,
                res: findHotelToReturn
            });
        }
    }catch(err) {
        console.log(err);
        res.status(responseMessages.hotelUpdateFailed.code).json({
            message: responseMessages.hotelUpdateFailed.message
        });
    }
}

adminController.deleteHotel = async function (req, res) {
    try{
        const deleteHotel = await Hotel.findOneAndDelete({ hotelName:req.body.hotelName });
        
        res.status(responseMessages.hotelDelete.code).json({
            message: responseMessages.hotelDelete.message,
        });
    }catch(err) {
        res.status(responseMessages.hotelDeleteError.code).json({
            message: responseMessages.hotelDeleteError.message
        });
    }
}

adminController.deleteHotelFromId = async function (req, res) {
    try{
        const deleteHotel = await Hotel.findOneAndDelete({ hotelNumber:req.body.hotelNumber });
        
        res.status(responseMessages.hotelDelete.code).json({
            message: responseMessages.hotelDelete.message,
        });
    }catch(err) {
        res.status(responseMessages.hotelDeleteError.code).json({
            message: responseMessages.hotelDeleteError.message
        });
    }
}
adminController.getAllHotels = async function(req, res){
    console.log("hello")
    const hotels = await Hotel.find({});
    if(hotels){
        res.status(responseMessages.hotelsFound.code).json({
            message: responseMessages.hotelsFound.message,
            hotels: hotels,
        });
    }else{
        res.status(responseMessages.hotelsNotFound.code).json({
            message: responseMessages.hotelsNotFound.message,
        });
    }
}
adminController.getHotel = async function(req,res){
    console.log("Hi there!")
    const hotel = await Hotel.findOne({hotelNumber: req.body.hotelNumber });
    if(hotel){
        res.status(responseMessages.hotelsFound.code).json({
            message: responseMessages.hotelsFound.message,
            hotel:hotel,
        });
    }else{
        res.status(responseMessages.hotelsNotFound.code).json({
            message: responseMessages.hotelsNotFound.message,
        });
    }
}
adminController.getHotelFromLocationAndDates = async function(req,res){
    console.log(req);
    try{
    const hotels = await Hotel.find({hotelLocation: req.body.hotelLocation}, {hotelNumber: 1});
    console.log("hotel info");
    console.log(hotels);
    const var1 = await Room.find({$and: [{$or: hotels}, {type: req.body.type}]}); 
    if(var1.length != 0){
        res.status(responseMessages.hotelsFound.code).json({
            message: responseMessages.hotelsFound.message,
            rooms:var1,
        }); 
    }
    else{
        res.status(responseMessages.hotelsFound.code).json({
            message: "in else-no search found"
        });  
    }
    let var2 = await Book.find({$or: var1});
    if(var2.length == 0){
        res.status(responseMessages.hotelsFound.code).json({
            message: responseMessages.hotelsFound.message,
            rooms:var1,
        }); 
    }
    try{
    if(var2==null)
      {
          var2=var1;
      }
    }
    catch(err)
    {
       console.log(err);
       console.log(var1);
    
    }
    
    for (const element of var2) {
           d1 = req.body.startDate;
           d2 = req.body.endDate;
           startD = element.startDate;
           endD = element.endDate;
           var dates = {
            convert:function(d) {
                
                return (
                    d.constructor === Date ? d :
                    d.constructor === Array ? new Date(d[0],d[1],d[2]) :
                    d.constructor === Number ? new Date(d) :
                    d.constructor === String ? new Date(d) :
                    typeof d === "object" ? new Date(d.year,d.month,d.date) :
                    NaN
                );
            },
            compare:function(a,b) {
                return (
                    isFinite(a=this.convert(a).valueOf()) &&
                    isFinite(b=this.convert(b).valueOf()) ?
                    (a>b)-(a<b) :
                    NaN
                );
            },
            inRange:function(d,start,end) {
               return (
                    isFinite(d=this.convert(d1).valueOf()) &&
                    isFinite(start=this.convert(start).valueOf()) &&
                    isFinite(end=this.convert(end).valueOf()) ?
                    start <= d && d <= end :
                    NaN
                        );
                 }
            }
            if (dates.inRange(d1,startD,endD) && dates.inRange(d2,startD,endD)){
                console.log("123")
                for (const i in var1){
                    console.log(var1[i])
                    if(var1[i].roomNumber == element.roomNumber){
                        console.log("1234")
                        var1.pop(i)
                    }
                }
                
                
            }
        
      }

    if(var1.length != 0 && var2.length !=0){
        res.status(responseMessages.hotelsFound.code).json({
            message: responseMessages.hotelsFound.message,
            rooms:var1,
        });
    }
    
    
    else{
        res.status(responseMessages.hotelsNotFound.code).json({
            message: responseMessages.hotelsNotFound.message,
        });
    }
}
catch(err){
console.log(err);
}
}

adminController.getHotelFromLocation = async function(req,res){
    const hotels = await Hotel.find({hotelLocation: req.body.hotelLocation });
    if(hotels.length != 0){
        res.status(responseMessages.hotelsFound.code).json({
            message: responseMessages.hotelsFound.message,
            hotels:hotels,
        });
    }else{
        res.status(responseMessages.hotelsNotFound.code).json({
            message: responseMessages.hotelsNotFound.message,
        });
    }
}

adminController.addRoom = async function(req,res){
    console.log("room added")
    const maxRoomNum = await Room.find({},{"roomNumber":1}).sort({_id:-1}).limit(1);
    const nextRoomNum = ((parseInt(maxRoomNum[0].roomNumber,10) < 1))?(parseInt(maxRoomNum[0].roomNumber,10) + 1):1;

    try{
        const room = {
            roomNumber : nextRoomNum,
            hotelNumber : req.body.hotelNumber,
            type : req.body.type,
            image : req.body.image,
            description : req.body.description,
            typeCharge : req.body.typeCharge,
            roomBasePrice : req.body.roomBasePrice,
            currentPrice : req.body.currentPrice
        }

        const roomCreated = await Room.create( room );
        
        const updateroom = await Room.findByIdAndUpdate( 
            { _id: roomCreated._id },
        );
        const updatedData = await Room.findOne({ _id: updateroom._id });

        result = {
            updatedData
        }

        res.status(responseMessages.hotelCreated.code).json({
            message: responseMessages.hotelCreated.message,
            result: result
        });
    
        
} catch(err) {
    console.log(err);
    res.status(responseMessages.hotelCreationFailed.code).json({
        message: responseMessages.hotelCreationFailed.message
    });
}
}
adminController.updateRoom = async function (req, res) {
    try{
        const findRoom = await Room.findOne({roomNumber:req.body.roomNumber});
        
        const room = await Room.findOneAndUpdate(
            { roomNumber:req.body.roomNumber },
            {
                ...req.body,
            }
        );
        
        const findRoomToReturn = await Room.findOne({roomNumber:req.body.roomNumber});
        
        if (findRoomToReturn) {
            res.status(responseMessages.hotelUpdate.code).json({
                message: responseMessages.hotelUpdate.message,
                res: findRoomToReturn
            });
        }
    }catch(err) {
        console.log(err);
        res.status(responseMessages.hotelUpdateFailed.code).json({
            message: responseMessages.hotelUpdateFailed.message
        });
    }
}

adminController.deleteRoom = async function (req, res) {
    try{
        const deleteRoom = await Room.findOneAndDelete({ roomNumber:req.body.roomNumber });

        res.status(responseMessages.hotelDelete.code).json({
            message: responseMessages.hotelDelete.message,
        });
    }catch(err) {
        res.status(responseMessages.hotelDeleteError.code).json({
            message: responseMessages.hotelDeleteError.message
        });
    }
}

adminController.getAllRooms = async function(req, res){
    console.log("hello")
    const rooms = await Room.find({});
    if(rooms){
        res.status(responseMessages.hotelsFound.code).json({
            message: responseMessages.hotelsFound.message,
            rooms: rooms.roomNumber,
            rooms: rooms.hotelDescription
        });
    }else{
        res.status(responseMessages.hotelsNotFound.code).json({
            message: responseMessages.hotelsNotFound.message,
        });
    }
}

adminController.getRoomFromHotel = async function(req,res){
    console.log("Hi there!")
    const rooms = await Room.find({hotelNumber: req.body.hotelNumber });
    if(rooms){
        res.status(responseMessages.hotelsFound.code).json({
            message: responseMessages.hotelsFound.message,
            rooms:rooms,
        });
    }else{
        res.status(responseMessages.hotelsNotFound.code).json({
            message: responseMessages.hotelsNotFound.message,
        });
    }
}
adminController.getPriceFromRoomNumber = async function(req,res){
    console.log("Hi there!")
    const room = await Room.findone({roomNumber: req.body.roomNumber });
    if(room){
        res.status(responseMessages.hotelsFound.code).json({
            message: responseMessages.hotelsFound.message,
            price:room.currentPrice,
        });
    }else{
        res.status(responseMessages.hotelsNotFound.code).json({
            message: responseMessages.hotelsNotFound.message,
        });
    }
}

adminController.getRoom = async function(req,res){
    console.log("Hi there!")
    // const room = await Room.findOne({roomNumber: req.params.hn });
    const room = await Room.findOne({roomNumber: req.body.roomNumber });
    if(room){
        res.status(responseMessages.hotelsFound.code).json({
            message: responseMessages.hotelsFound.message,
            // room:room.roomNumber,
            room:room
        });
    }else{
        res.status(responseMessages.hotelsNotFound.code).json({
            message: responseMessages.hotelsNotFound.message,
        });
    }
}

adminController.addBooking = async function(req,res){
    console.log("booking")
    try{

        // const maxBookingNums = await Book.find(`bookingNumber`);
        const maxBookingNums = await Book.find({},{"bookingNumber":1}).sort({_id:-1}).limit(1);
        // const maxBookingNums = Book.find({}).sort({_id:-1}).limit(1);
        console.log(maxBookingNums[0].bookingNumber);

        const nextBookingNum = ((parseInt(maxBookingNums[0].bookingNumber,10) < 1))?(parseInt(maxBookingNums[0].bookingNumber,10) + 1):1;

        const book = {
            bookingNumber: nextBookingNum,
            userId: req.body.userId,
            hotelId: req.body.hotelId,
            roomId: req.body.roomID,
            // userName: req.body.userName,
            // hotelNumber: req.body.hotelNumber,
            // roomNumber: req.body.roomNumber,
            amount: req.body.amount,
            startDate: req.body.startDate,
            endDate: req.body.endDate,
            guests: req.body.guests,
            // status: req.body.status,
            status: "Success"
            // price: price
        }

        const bookingCreated = await Book.create( book );
        let user = await Admin.findById({_id: req.body.userId})
        var newBalance = user.rewardPoints - req.body.rewardPoints
        user = await Admin.findOneAndUpdate({_id: req.body.userId},{
            rewardPoints: newBalance
        });
        const updateBooking = await Book.findByIdAndUpdate( 
            { _id: bookingCreated._id },
        );
        const updatedData = await Book.findOne({ _id: updateBooking._id });

        result = {
            updatedData
        }
        
        res.status(responseMessages.hotelCreated.code).json({
            message: responseMessages.hotelCreated.message,
            result: result
        });
    
        
} catch(err) {
    console.log(err);
    res.status(responseMessages.hotelCreationFailed.code).json({
        message: responseMessages.hotelCreationFailed.message
    });
}
}

adminController.updateBooking = async function (req, res) {
    try{
        const findBooking = await Book.findOne({bookingNumber:req.body.bookingNumber});
        let user = await Admin.findOne({userId: req.body.userId})
        bookingAmount1 = findBooking[0].amount
        var rewardPointsPrev = user[0].rewardPoints
        const room = await Room.find({roomNumber: req.body.roomNumber});
        console.log(room);
        const roomBasePrice = room[0].roomBasePrice;
        var start = new Date(req.body.startDate);
        var end = new Date(req.body.endDate);
        const hotel = await Hotel.find({hotelNumber: room[0].hotelNumber});
        var loop = new Date(start);
        const weekendCharge = hotel[0].weekendCharge
        const breakfast = req.body.breakfast
        const meal = req.body.meal 
        const gym = req.body.gym 
        const pool = req.body.pool 
        const parking = req.body.parking 
        const extraGuestCharge = req.body.guests
        console.log(roomBasePrice);
        console.log(weekendCharge);
        console.log(start);
        console.log(end);

        var Holidays = require('date-holidays');
        var hd = new Holidays();
        hd.getStates('US');
        hd.init('US'); 
        hd.getHolidays(2022);

        var c1 = 0;
        //var c2 = 0;
        while(loop <= end){
            if (loop.getDay() == 6 || loop.getDay() == 0){
                
                c1 += weekendCharge 
                console.log(c1)
            }

            if (hd.isHoliday(loop) == true) { 
                c1 += holidayCharge;
            }
            
            var newDate = loop.setDate(loop.getDate() + 1);
            loop = new Date(newDate);
        }
        let total = c1 + roomBasePrice;
        if (breakfast){
            total+= hotel[0].breakfast
        }
        if (meal){
            total+= hotel[0].meal
        }if (gym){
            total+= hotel[0].gym
        }if (pool){
            total+= hotel[0].pool
        }if (parking){
            total+= hotel[0].parking
        }if (guests == "3"){
            total+= hotel[0].extraGuestCharge
        }
        var bookingAmount2 = total
        if (bookingAmount2>bookingAmount1){
            var difference = bookingAmount2-bookingAmount1
        }
        else{
            newBalance = bookingAmount1-bookingAmount2 + rewardPointsPrev
            user = await Admin.findOneAndUpdate({_id: req.body.userId},{
                rewardPoints: newBalance
            });
        }

        const booking = await Book.findOneAndUpdate(
            { bookingNumber:req.body.bookingNumber },
            {
            userId: req.body.userId,
            bookingNumber: req.body.bookingNumber,
            hotelId: req.body.hotelId,
            roomId: req.body.roomID,
            roomNumber: req.body.roomNumber,
            amount: bookingAmount2,
            startDate: req.body.startDate,
            endDate: req.body.endDate,
            guests: req.body.guests,
            status: req.body.status,
            price: req.body.price
            }
        );
        
        const findBookingToReturn = await Book.findOne({bookingNumber:req.body.bookingNumber});
        
        if (findBookingToReturn) {
            res.status(responseMessages.hotelUpdate.code).json({
                message: responseMessages.hotelUpdate.message,
                res: findBookingToReturn,
                diff: difference

            });
        }
    }catch(err) {
        console.log(err);
        res.status(responseMessages.hotelUpdateFailed.code).json({
            message: responseMessages.hotelUpdateFailed.message
        });
    }
}

adminController.calculatePrice = async function(req,res){
    const room = await Room.find({roomNumber: req.body.roomNumber});
    console.log(room);
    const roomBasePrice = room[0].roomBasePrice;
    var start = new Date(req.body.startDate);
    var end = new Date(req.body.endDate);
    const hotel = await Hotel.find({hotelNumber: room[0].hotelNumber});
    var loop = new Date(start);
    const weekendCharge = hotel[0].weekendCharge
    const breakfast = req.body.breakfast
    const meal = req.body.meal
    const gym = req.body.gym
    const pool = req.body.pool
    const parking = req.body.parking
    const extraGuestCharge = req.body.guests
    console.log(roomBasePrice);
    console.log(weekendCharge);
    console.log(start);
    console.log(end);

    var Holidays = require('date-holidays');
    var hd = new Holidays();
    hd.getStates('US');
    hd.init('US');
    hd.getHolidays(2022);

    var c1 = 0;
    //var c2 = 0;
    while(loop <= end){
        if (loop.getDay() == 6 || loop.getDay() == 0){

            c1 += weekendCharge
            console.log(c1)
        }

        if (hd.isHoliday(loop) == true) {
            c1 += holidayCharge;
        }

        var newDate = loop.setDate(loop.getDate() + 1);
        loop = new Date(newDate);
    }
    let total = c1 + roomBasePrice;
    if (breakfast){
        total+= hotel[0].breakfast
    }
    if (meal){
        total+= hotel[0].meal
    }if (gym){
        total+= hotel[0].gym
    }if (pool){
        total+= hotel[0].pool
    }if (parking){
        total+= hotel[0].parking
    }if (guests == "3"){
        total+= hotel[0].extraGuestCharge
    }



    res.json({
        message:"Calculated",
        price: total

    })
}

adminController.getBookingFromUserId = async function(req,res){
    console.log("Hi there!")
    const bookings = await Book.find({userId: req.body.userId});
    if(bookings){
        res.status(responseMessages.hotelsFound.code).json({
            message: responseMessages.hotelsFound.message,
            bookings:bookings,
        });
    }else{
        res.status(responseMessages.hotelsNotFound.code).json({
            message: responseMessages.hotelsNotFound.message,
        });
    }
}

adminController.getBookingFromBookingNumber = async function(req,res){
    console.log("Hi there!")
    const booking = await Book.find({bookingNumber: req.body.bookingNumber});
    if(booking){
        res.status(responseMessages.hotelsFound.code).json({
            message: responseMessages.hotelsFound.message,
            booking:booking,
        });
    }else{
        res.status(responseMessages.hotelsNotFound.code).json({
            message: responseMessages.hotelsNotFound.message,
        });
    }
}

adminController.getAllBookings = async function(req, res){
    console.log("hello")
    const bookings = await Book.find({});
    if(bookings){
        res.status(responseMessages.hotelsFound.code).json({
            message: responseMessages.hotelsFound.message,
            bookings: bookings
        });
    }else{
        res.status(responseMessages.hotelsNotFound.code).json({
            message: responseMessages.hotelsNotFound.message,
        });
    }
}

adminController.deleteBookingFromId = async function (req, res) {
    try{
        const deleteBooking = await Book.findOneAndDelete({ bookingNumber:req.body.bookingNumber });
        
        res.status(responseMessages.hotelDelete.code).json({
            message: responseMessages.hotelDelete.message,
        });
    }catch(err) {
        res.status(responseMessages.hotelDeleteError.code).json({
            message: responseMessages.hotelDeleteError.message
        });
    }
}
module.exports = adminController;