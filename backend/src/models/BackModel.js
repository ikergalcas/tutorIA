import mongoose from 'mongoose'

const dbSchema = new mongoose.Schema({
    bloquesRelevantes: {
        type: Array,
        default: []
    },
    id: {
        type: Number,
        default: 1,
        unique: true
    }
},{ versionKey: false });

export default mongoose.model('bloques', dbSchema)