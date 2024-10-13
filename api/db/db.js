import loki from "lokijs";
import { v4 as uuid } from "uuid";
import dotenv from "dotenv";
import _ from "lodash";
import dayjs from "dayjs";

// Setup
dotenv.config();

const dbFile = process.env.DB_FILE;

let db;

export async function initDatabase() {
  db = new loki(dbFile, {
    autoload: true,
    autoloadCallback: databaseInitialized,
    autosave: true,
    autosaveInterval: 4000,
  });

  return db;
}

async function databaseInitialized() {
  let { Days } = getDbCollections();

  if (Days === null) {
    Days = db.addCollection("days");
  }

  console.log("Database initialized.");
}

export function getDb() {
  return db;
}

export function getDbCollections() {
  const collections = {
    Days: "days",
  };

  return Object.fromEntries(
    Object.entries(collections).map(([key, value]) => [
      key,
      db.getCollection(value),
    ])
  );
}