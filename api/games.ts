import type { VercelRequest, VercelResponse } from "@vercel/node";
import { connectDB } from "../src/mongodb";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const db = await connectDB();

    const data = await db.collection("games").find({}).toArray();

    res.status(200).json(data);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "MongoDB connection failed",
    });
  }
}