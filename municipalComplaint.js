'use strict';
const supportedServices = {
        'Noida':{'type': ['civil', 'Horticulture', 'Health', 'Electrical']}, 
        'Mumbai':{'type': ['Civil', 'Electrical']}
};

// --------------- Helpers to build responses which match the structure of the necessary dialog actions -----------------------

function elicitSlot(sessionAttributes, intentName, slots, slotToElicit, message, responseCard) {
	return {
		sessionAttributes,
		dialogAction: {
			type: 'ElicitSlot',
			intentName,
			slots,
			slotToElicit,
			message,
			responseCard,
		},
	};
}

function confirmIntent(sessionAttributes, intentName, slots, message, responseCard) {
	return {
		sessionAttributes,
		dialogAction: {
			type: 'ConfirmIntent',
			intentName,
			slots,
			message,
			responseCard,
		},
	};
}

function close(sessionAttributes, fulfillmentState, message, responseCard) {
	return {
		sessionAttributes,
		dialogAction: {
			type: 'Close',
			fulfillmentState,
			message,
			responseCard,
		},
	};
}

function delegate(sessionAttributes, slots) {
	return {
		sessionAttributes,
		dialogAction: {
			type: 'Delegate',
			slots,
		},
	};
}



// ---------------- Helper Functions --------------------------------------------------

// build a message for Lex responses
function buildMessage(messageContent) {
    return {
		contentType: 'PlainText',
		content: messageContent,
    };
}

// Build a responseCard with a title, subtitle, and an optional set of options which should be displayed as buttons.
function buildResponseCard(title, subTitle, options) {
    let buttons = null;
    if (options !== null) {
        buttons = [];
// Need to check the below 5 attribute <HP>
        for (let i = 0; i < Math.min(5, options.length); i++) {
            buttons.push(options[i]);
        }
    }
    return {
        contentType: 'application/vnd.amazonaws.card.generic',
        version: 1,
        genericAttachments: [{
            title,
            subTitle,
            buttons,
        }],
    };
}

function buildResponseOptions(optionsArray = Array){
    var responseOptions = [];
    for(var i=0; i<optionsArray.length; i++){
        var temp = {
            "text": optionsArray[i],
            "value": optionsArray[i]
        }
        responseOptions.push(temp);
    }
    return responseOptions;
}

function keyExists(key, search) {
    if (!search || (search.constructor !== Array && search.constructor !== Object)) {
        return false;
    }
    for (var i = 0; i < search.length; i++) {
        if (search[i] === key) {
            return true;
        }
    }
    return key in search;
}

// --------------- HP to be modified -----------------------

/**
 * Performs dialog management and fulfillment for placing a complaint.
 * (we only support ordering few complaint types as of now)
 */
function takeComplaint(intentRequest, callback) {

	const outputSessionAttributes = intentRequest.sessionAttributes;
	const source = intentRequest.invocationSource;

	if (source === 'DialogCodeHook') {

		// perform validation on the slot values we have
		const slots = intentRequest.currentIntent.slots;

		const complaintCity = (slots.City ? slots.City : null);
		const complaintType = (slots.Type ? slots.Type : null);
		const complaintRegion = (slots.Region ? slots.Region : null);

        
        if(! (complaintCity && (keyExists(complaintCity, supportedServices))))
        {
            var complaintRec = buildResponseOptions(Object.keys(supportedServices));
            
            callback(elicitSlot(outputSessionAttributes, intentRequest.currentIntent.name, slots, 'City', 
			    buildMessage('Sorry, but we can only do a Noida or a Mumbai. How can we help in these cities?'), 
			    buildResponseCard("City", "Available Services", complaintRec)));
		}

		// let's assume we only accept few complaint category for now
		if (!(complaintType && complaintType.match(/Electrical|Civil|Horticulture|Health/) && keyExists(complaintType, supportedServices[complaintCity].type))) 
		{
		    if(complaintType)
			{
		        var sizeOfItem = buildResponseOptions(supportedServices[complaintCity].type);
            
			    callback(elicitSlot(outputSessionAttributes, intentRequest.currentIntent.name, slots, 'Type',
			        buildMessage('Sorry, but we don\'t cater to this city.  Keep watching this space for more'),
			        buildResponseCard(`${complaintCity}`, "Cities", sizeOfItem)
			    ));
		    }else{
		        callback(elicitSlot(outputSessionAttributes, intentRequest.currentIntent.name, slots, 'Type'));
		    }
		}

		// let's say we need to know temperature for Noidas
		if (!(complaintRegion && complaintRegion.match(/Noida|Mumbai/))) {
			callback(elicitSlot(outputSessionAttributes, intentRequest.currentIntent.name, slots, 'municipalCity'));
		}

		// if we've come this far, then we simply defer to Lex
		callback(delegate(outputSessionAttributes, slots));
		return;
	}

	callback(close(outputSessionAttributes, 'Fulfilled', {
		contentType: 'PlainText',
		content: `Great!  Your ${intentRequest.currentIntent.slots.Type} has been noted and will be actioned soon.  Thanks for using GoodCitizen app!`
	}));
}
// --------------- To be modified end-----------------------

// --------------- Intents -----------------------

/**
 * Called when the user specifies an intent for this skill.
 */
function dispatch(intentRequest, callback) {

	console.log(`dispatch userId=${intentRequest.userId}, intent=${intentRequest.currentIntent.name}`);

	const name = intentRequest.currentIntent.name;

	// dispatch to the intent handlers
	if (name.startsWith('RaiseCivicComplaint')) {
		return takeComplaint(intentRequest, callback);
	}
	throw new Error(`Intent with name ${name} not supported`);
}

// --------------- Main handler -----------------------

// Route the incoming request based on intent.
// The JSON body of the request is provided in the event slot.
exports.handler = (event, context, callback) => {

	console.log(JSON.stringify(event));

	try {
		console.log(`event.bot.name=${event.bot.name}`);

		// fail if this function is for a different bot
		if(! event.bot.name.startsWith('MunicipalComplaint')) {
		     callback('Invalid Bot Name');
		}
		dispatch(event, (response) => callback(null, response));
	} catch (err) {
		callback(err);
	}
};
