import { connectDB } from "../src/mongodb";

export default async function handler(req, res) {
  try {
    const db = await connectDB();

    const data = await db
      .collection("games")
      .find({})
      .toArray();

    return res.status(200).json(data);

  } catch (error) {
    console.log(error);

    return res.status(500).json({
      error: "MongoDB connection failed"
    });
  }
}