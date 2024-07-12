import mongoose from 'mongoose'

export const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL)
        console.log("Conexión establecida con la base de datos")        
    } catch (error) {
        console.log(error)
    }
};

