// Imports
import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import _ from 'lodash';
import process from 'process';
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore.js";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter.js";

import { initDatabase, getDbCollections } from "./db/db.js";
import { asyncWrapper, APIError } from "./utils/utils.js";
import { CALENDAR_ID, getCalendar } from "./calendar/calendar.js";

// Setup
dotenv.config();
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const app = express();

app.use(cors("*"));
app.use(express.json());
app.use(morgan("combined"));

const itemsPerDay = [
    { startTime: "08:00", endTime: "08:30" },
    { startTime: "15:00", endTime: "15:30" }
]

// Routes
app.get(
    "/ping",
    asyncWrapper(async (req, res, next) => {
        return res.send("pong");
    })
);

app.get(
    "/",
    asyncWrapper(async (req, res, next) => {
        const { Days } = getDbCollections();
        const days = Days.find();

        return res.json({ days });
    })
);

app.post(
    "/",
    asyncWrapper(async (req, res, next) => {
        const { Days } = getDbCollections();

        const oldDates = Days.find().map(day => day.date);
        const newDates = req.body.days.map(day => day.date);

        const daysToCreate = req.body.days.filter(day => _.without(newDates, ...oldDates).includes(day.date));
        const datesToEdit = _.intersection(newDates, oldDates);
        const daysToRemove = Days.find().filter(day => _.without(oldDates, ...newDates).includes(day.date));

        const calendar = await getCalendar();

        // Create new events
        await Promise.all(daysToCreate.map(async day => {
            await Promise.all(day.items.map(async (item, index) => {
                if (item.owner != null) {
                    const { startTime, endTime } = itemsPerDay[index];

                    const resource = {
                        summary: `${item.owner} Bychen`,
                        start: {
                            dateTime: `${day.date}T${startTime}:00`,
                            timeZone: "Europe/Berlin"
                        },
                        end: {
                            dateTime: `${day.date}T${endTime}:00`,
                            timeZone: "Europe/Berlin"
                        },
                        extendedProperties: {
                            shared: { app: "byta-0", date: day.date, index, owner: item.owner }
                        }
                    };
                    const event = await calendar.events.insert({
                        calendarId: CALENDAR_ID,
                        resource: resource
                    });

                    item.eventId = event.data.id;
                }

            }));

            Days.insert(day);
        }));

        // Update existing events
        let numberOfEditedDays = 0;
        await Promise.all(datesToEdit.map(async date => {
            const oldDay = Days.findOne({ date: date });
            const newDay = req.body.days.find(day => day.date == date);

            let edited = false;
            await Promise.all(_.zip(oldDay.items, newDay.items).map(async ([oldItem, newItem], index) => {
                if (oldItem.owner != newItem.owner) {
                    if (oldItem.owner) {
                        if (newItem.owner) {
                            // Edit
                            await calendar.events.patch({
                                calendarId: CALENDAR_ID,
                                eventId: oldItem.eventId,
                                requestBody: { 
                                    summary: `${newItem.owner} Bychen`, 
                                    extendedProperties: {
                                        shared: { app: "byta-0", date, index, owner: newItem.owner }
                                    }
                                }
                            });

                            oldItem.owner = newItem.owner;

                            edited = true;
                        } else {
                            // Remove
                            if (oldItem.eventId) {
                                await calendar.events.delete({
                                    calendarId: CALENDAR_ID,
                                    eventId: oldItem.eventId
                                });
                            }
                            oldItem.owner = null;
                            delete oldItem.eventId;

                            edited = true;
                        }
                    } else {
                        if (newItem.owner) {
                            // Insert
                            const { startTime, endTime } = itemsPerDay[index];

                            const resource = {
                                summary: `${newItem.owner} Bychen`,
                                start: {
                                    dateTime: `${date}T${startTime}:00`,
                                    timeZone: "Europe/Berlin"
                                },
                                end: {
                                    dateTime: `${date}T${endTime}:00`,
                                    timeZone: "Europe/Berlin"
                                },
                                extendedProperties: {
                                    shared: { app: "byta-0", date, index, owner: newItem.owner }
                                }
                            };
                            const event = await calendar.events.insert({
                                calendarId: CALENDAR_ID,
                                resource: resource
                            });

                            oldItem.owner = newItem.owner;
                            oldItem.eventId = event.data.id;

                            edited = true;
                        } else {
                            // Nothing to do
                        }
                    }
                }
            }));
            Days.update(oldDay);

            if (edited) {
                numberOfEditedDays++;
            }
        }));

        // Delete old events
        await Promise.all(daysToRemove.map(async day => {
            await Promise.all(day.items.map(async item => {
                if (item.eventId) {
                    await calendar.events.delete({
                        calendarId: CALENDAR_ID,
                        eventId: item.eventId
                    });
                }
            }));
            Days.remove(day);
        }));

        const days = Days.find();

        return res.json({ days, created: daysToCreate.length, edited: numberOfEditedDays, removed: daysToRemove.length });
    })
);

app.get("/sync", asyncWrapper(async (req, res, next) => {
    const { Days } = getDbCollections();

    const calendar = await getCalendar();
    const events = (await calendar.events.list({
        calendarId: CALENDAR_ID,
        q: "Bychen"
    })).data.items;
    const filteredEvents = events.filter(event => event.extendedProperties?.shared?.app == "byta-0");
    const dates = _.uniq(filteredEvents.map(event => dayjs(event.start.dateTime).format('YYYY-MM-DD')));

    const days = dates.map(date => {
        const items = [{ owner: null }, { owner: null }];

        [0, 1].forEach(index => {
            const event = filteredEvents.find(event => event.extendedProperties.shared.date == date && event.extendedProperties.shared.index == index);
            if (event) {
                items[index] = { owner: event.extendedProperties.shared.owner, eventId: event.id };
            }
        });

        return { date, items, comment: Days.find({ date })?.comment || "" };
    });

    // Replace database by filteredEvents
    Days.clear();
    Days.insert(days);

    return res.json({ days });
}));

// Error handling with APIError
app.use(function (err, req, res, next) {
    const statusCode = err.statusCode || 500;
    console.error(err.message, err.stack);

    return res.status(statusCode).json({
        success: false,
        notification: { message: err.message },
        ...err.info,
    });
});

const db = await initDatabase();
console.log("Database initialized, starting server...");

// Start the server
const port = process.env.PORT;
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Handle server shutdown
const shutdown = async () => {
    console.log("Server is shutting down...");

    db.close();
    console.log("Database closed.");

    server.close();
    console.log("Server closed.");
    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
