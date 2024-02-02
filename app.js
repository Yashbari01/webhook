
"use strict";

const token = process.env.WHATSAPP_TOKEN;
const verifyToken = process.env.VERIFY_TOKEN;

// Imports dependencies and set up http server
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios").default;
// const { SessionsClient } = require('dialogflow').v2;

const app = express().use(bodyParser.json()); // creates express http server

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log("webhook is listening"));

// Handle incoming messages from WhatsApp
app.post("/webhook", (req, res) => {
    try {
        let body = req.body;
        console.log('body', body);
        if (
            body &&
            body.object &&
            body.entry &&
            body.entry[0].changes &&
            body.entry[0].changes[0] &&
            body.entry[0].changes[0].value.messages &&
            body.entry[0].changes[0].value.messages[0]
        ) {
            let phone_number_id = body.entry[0].changes[0].value.metadata.phone_number_id;
            let from = body.entry[0].changes[0].value.messages[0].from;
            let message = body.entry[0].changes[0].value.messages[0].text;

            if (message) {
                handleUserMessage(phone_number_id, from, message);
            } else {
                console.error("Invalid message format:", body);
            }

            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error("Error processing webhook:", error);
        res.sendStatus(500);
    }
});

// Handle GET requests for webhook verification
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const receivedToken = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    console.log('mode', mode);
    console.log('receivedToken', receivedToken);
    console.log('challenge', challenge);

    if (mode === "subscribe" && receivedToken === verifyToken) {
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// Dialogflow configuration
const credentials = JSON.parse(process.env.CREDENTIALS);
const projectId = credentials.project_id;
const dialogflowConfig = {
    credentials: {
        private_key: credentials.private_key,
        client_email: credentials.client_email,
    },
};
const { SessionsClient } = require('@google-cloud/dialogflow');

const sessionClient = new SessionsClient(dialogflowConfig);

// Handle incoming user messages
async function handleUserMessage(phoneNumberId, from, message) {
    try {
        // Send the user message to Dialogflow for processing
        const dialogflowResponse = await sendToDialogflow(message, phoneNumberId);
        console.log('dialogflowResponse', dialogflowResponse);
        // Send the Dialogflow response back to the user
        sendResponseToUser(phoneNumberId, from, dialogflowResponse);
    } catch (error) {
        console.error("Error handling user message:", error);
    }
}

// Send user message to Dialogflow
async function sendToDialogflow(userMessage, sessionId) {
    console.log('userMessage:', userMessage);
    console.log('sessionId:', sessionId);

    const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);
    console.log('sessionPath', sessionPath);

    const request = {
        session: sessionPath,
        queryInput: {
            text: {
                text: userMessage,
                languageCode: 'en',
            },
        },
    };
    console.log("request:", request);
    const [response] = await sessionClient.detectIntent(request);
    console.log('dialogflow response:', response);
    return response.queryResult.fulfillmentText;
}


// console.log("WHATSAPP_TOKEN:", process.env.WHATSAPP_TOKEN);
// console.log("VERIFY_TOKEN:", process.env.VERIFY_TOKEN);
// console.log("CREDENTIALS:", process.env.CREDENTIALS);
// console.log("Credentials:", credentials);

// Send Dialogflow response back to the user
function sendResponseToUser(phoneNumberId, to, text) {
    axios.post(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages?access_token=${token}`, {
        messaging_product: "whatsapp",
        to: to,
        text: { body: text },
    })
        .then(response => {
            console.log("Message sent successfully:", response.data);
        })
        .catch(error => {
            console.error("Error sending message:", error);
        });
}
