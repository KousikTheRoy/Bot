// https://github.com/Kousik_The_Roy

const fs = require("fs");
const axios = require("axios");
const PDFDocument = require("pdfkit");
const brainly = require("brainly-scraper");
const tesseract = require("node-tesseract-ocr");
const webpConverter = require("./lib/webpconverter.js")
const WSF = require("wa-sticker-formatter");
const { MessageType, Mimetype } = require("@adiwajshing/baileys");
const conn = require("./lib/conn.js");

const inPdfInput = [];
const bufferImagesForPdf = {};
const quotesList = JSON.parse(fs.readFileSync("lib/quotes.json", "utf-8"));
const factList = JSON.parse(fs.readFileSync("lib/fact.json", "utf-8"));

module.exports = async (message) => {
	const senderNumber = message.key.remoteJid;
	const imageMessage = message.message.imageMessage;
	const stickerMessage = message.message.stickerMessage;
	const extendedTextMessage = message.message.extendedTextMessage;
	const quotedMessage = extendedTextMessage && extendedTextMessage.contextInfo && extendedTextMessage.contextInfo.quotedMessage;
	const textMessage = message.message.conversation || message.message.extendedTextMessage && message.message.extendedTextMessage.text || imageMessage && imageMessage.caption;
	let command, parameter;
	if (textMessage) {
		// command = textMessage.trim().split(" ")[0];
		// parameter = textMessage.trim().split(" ").slice(1).join(" ");

		let a = textMessage.trim().split("\n");
		let b = "";
		command = a[0].split(" ")[0];
		b += a[0].split(" ").slice(1).join(" ");
		b += a.slice(1).join("\n")
		parameter = b.trim();
	}

	if (inPdfInput.includes(senderNumber)) {
		if (stickerMessage) return;
		if (command == "!done" || bufferImagesForPdf[senderNumber].length > 19) {
			const pdf = new PDFDocument({ autoFirstPage:false });
			const bufferImages = bufferImagesForPdf[senderNumber];
			for (const bufferImage of bufferImages) {
				const image = pdf.openImage(bufferImage);
				pdf.addPage({ size:[image.width, image.height] });
				pdf.image(image, 0, 0);
			}

			const pathFile = ".temp/" + Math.floor(Math.random() * 1000000 + 1) + ".pdf";
			const file = fs.createWriteStream(pathFile);
			pdf.pipe(file)
			pdf.end()

			file.on("finish", () => {
				const file = fs.readFileSync(pathFile);
				conn.sendMessage(senderNumber, file, MessageType.document, { mimetype: Mimetype.pdf, filename: Math.floor(Math.random() * 1000000) + ".pdf", quoted: message});
				fs.unlinkSync(pathFile);
				inPdfInput.splice(inPdfInput.indexOf(senderNumber), 1);
				delete bufferImagesForPdf[senderNumber];
			})

		} else if (command == "!cancel") {
			delete bufferImagesForPdf[senderNumber];
			inPdfInput.splice(inPdfInput.indexOf(senderNumber), 1);
			conn.sendMessage(senderNumber, "Operasi dibatalkan!", MessageType.text, { quoted: message })

		} else if (imageMessage && imageMessage.mimetype == "image/jpeg") {
			const bufferImage = await conn.downloadMediaMessage(message);
			bufferImagesForPdf[senderNumber].push(bufferImage);

			conn.sendMessage(senderNumber, `[${bufferImagesForPdf[senderNumber].length}] Add image successfully, send *! Done * if done, *! Cancel * if you want to cancel`, MessageType.text, { quoted: message })
			
		} else {
			conn.sendMessage(senderNumber, "That's not a picture! send *! done * if done, *! cancel * if you want to cancel", MessageType.text, { quoted: message })
		}

		return;
	}

	switch (command) {
		case "!help":
		{
			const text = `Hello Sir Welcome To *${conn.user.name}*!

- send *! help * to see a list of commands from this bot

- send *! contact * to contact the bot builder

- Send a picture with the caption *! sticker * to make a sticker

- Send *! pdf * to create a pdf from an image

- reply sticker with the caption *! toimg * to make a sticker to the image

- send *! textsticker [your text] * to create a text sticker
  example:! this textsticker sticker

- Send *! write [enter text here] * to write to paper
  example:! write this my writing

- Send *! brainly [your question] * to search for questions and answers in brainly
  example:! brainly what nodejs is

- *! quotes * to get quotes

- *! randomfact * to get random knowledge

- *! gtts [language code] [text] * to change text to google voice. For language codes, see here https://s.id/xSj1g
   example:! gtts my bot id

- *! wikipedia [query] * to search and read articles on wikipedia
   example:! Python wikipedia

- Send an image with the caption *! ocr * to get the text of the image

- Send a picture with the caption *! wait * to search for anime titles and episodes from the scene

Bots are sensitive to symbols / spaces / lowercase / uppercase letters so they won't reply if a typo occurs!`.replace("Bot Created By Kousik", "");

			conn.sendMessage(senderNumber, text, MessageType.text, { quoted: message });
			break;
		}

		case "!contact":
		{
			const text = `Contact Me At
       
- Facebook: fb.me/Kousik.The.Ray
- Email: kousikroy413@gmail.com`;
			conn.sendMessage(senderNumber, text, MessageType.text, { quoted: message });
			break;
		}

		case "!sticker":
		case "!stiker":
		{
			if (quotedMessage) {
				message.message = quotedMessage;
			}

			if (!message.message.imageMessage || message.message.imageMessage.mimetype != "image/jpeg") {
				conn.sendMessage(senderNumber, "No picture :)", MessageType.text, { quoted: message });
				break;
			}

			const imagePath = await conn.downloadAndSaveMediaMessage(message, Math.floor(Math.random() * 1000000));
			const sticker = new WSF.Sticker("./" + imagePath, { crop: false, pack: "github.com/salismazaya", author: conn.user.name });
			await sticker.build();
			fs.unlinkSync(imagePath);
			const bufferImage = await sticker.get();
			conn.sendMessage(senderNumber, bufferImage, MessageType.sticker, { quoted: message });
			break;
		}

		case "!toimg":
		{
			if (!quotedMessage || !quotedMessage.stickerMessage || quotedMessage.stickerMessage.mimetype != "image/webp") {
				conn.sendMessage(senderNumber, "Harus me-reply sticker :)", MessageType.text, { quoted: message });
				break;
			}

			message.message = quotedMessage;
			const webpImage = await conn.downloadMediaMessage(message);
			const jpgImage = await webpConverter.webpToJpg(webpImage);
			conn.sendMessage(senderNumber, jpgImage, MessageType.image, { quoted: message, caption: "Ini gambarnya kak!" });
			break;
		}

		case "!write":
		case "!nulis":
		{
			if (!parameter) {
				conn.sendMessage(senderNumber, "No text :)", MessageType.text, { quoted: message });
				break;
			}

			const response = await axios.post("https://salism3api.pythonanywhere.com/write", { "text": parameter });
			const imagesUrl = response.data.images.slice(0, 4);

			for (const imageUrl of imagesUrl) {
				const response = await axios({
					url: imageUrl,
					method: "GET",
					responseType: "arraybuffer",
				});
				const image = Buffer.from(response.data, "binary");
				await conn.sendMessage(senderNumber, image, MessageType.image, { quoted: message });
			}
			break;
		}

		case "!pdf":
		{
			if (message.participant) {
				conn.sendMessage(senderNumber, "This feature does not work in groups :(", MessageType.text, { quoted: message });
				break;
			}

			if (imageMessage) {
				conn.sendMessage(senderNumber, "Send without pictures!", MessageType.text, { quoted: message });
				break;
			}

			inPdfInput.push(senderNumber);
			bufferImagesForPdf[senderNumber] = [];

			conn.sendMessage(senderNumber, "Please send the pictures one by one! don't spam!", MessageType.text, { quoted: message });
			break;
		}

		case "!brainly":
		{
			if (!parameter) {
				conn.sendMessage(senderNumber, "The input is wrong sir :)", MessageType.text, { quoted: message });
				break;
			}

			const data = await brainly(parameter);
			if (data.succses && data.data.length <= 0) {
				conn.sendMessage(senderNumber, "Pertanyaan tidak ditemukan :(", MessageType.text, { quoted: message })

			} else if (data.success) {
				for (const question of data.data.slice(0, 3)) {
					const text = `*Pertanyaan:* ${question.pertanyaan.trim()}\n\n*Jawaban*: ${question.jawaban[0].text.replace("Jawaban:", "").trim()}`
					await conn.sendMessage(senderNumber, text, MessageType.text, { quoted: message })
				}
			}
			break;
		}

		case "!quotes":
		{
			const quotes = quotesList[Math.floor(Math.random() * quotesList.length)];
			const text = `_"${quotes.quote}"_\n\n - ${quotes.by}`;
			conn.sendMessage(senderNumber, text, MessageType.text, { quoted: message });
			break;
		}

		case "!randomfact":
		case "!fact":
		{
			const fact = factList[Math.floor(Math.random() * factList.length)];
			const text = `_${fact}_`
			conn.sendMessage(senderNumber, text, MessageType.text, { quoted: message });
			break;
		}

		case "!gtts":
		case "!tts":
		case "!text2sound":
		{
			if (!parameter) {
				conn.sendMessage(senderNumber, "The input is wrong sir :)", MessageType.text, { quoted: message });
				break;
			}

			if (parameter.split(" ").length == 1) {
				conn.sendMessage(senderNumber, "No language / text code", MessageType.text, { quoted: message });
				break;
			}

			const language = parameter.split(" ")[0];
			const text = parameter.split(" ").splice(1).join(" ");
			axios({
				url: `https://salism3api.pythonanywhere.com/text2sound`,
				method: "POST",
				responseType: "arraybuffer",
				data: {
					"languageCode": language,
					"text": text,
				}
			}).then(response => {
				const audio = Buffer.from(response.data, "binary");
				conn.sendMessage(senderNumber, audio, MessageType.audio, { ptt: true, quoted: message });

			}).catch(response => {
				conn.sendMessage(senderNumber, `Kode bahasa *${language}* tidak ditemukan :(`, MessageType.text, { quoted: message });

			});
			break;
		}

		case "!wikipedia":
		case "!wiki":
		{
			if (!parameter) {
				conn.sendMessage(senderNumber, "The input is wrong sir :)", MessageType.text, { quoted: message });
				break;
			}

			axios.post("http://salism3api.pythonanywhere.com/wikipedia", { "query":parameter })
				.then(response => {
					const text = `*${response.data.title}*\n\n${response.data.content}`;
					conn.sendMessage(senderNumber, text, MessageType.text, { quoted: message });
				})
				.catch(e => {
					if ([ 500, 400, 404 ].includes(e.response.status)) {
						conn.sendMessage(senderNumber, `Article not found :(`, MessageType.text, { quoted: message });
					} else {
						throw e;
					}
				})
			break;
		}

		case "!wait":
		case "!whatanime":
		{
			if (quotedMessage) {
				message.message = quotedMessage;
			}

			if (!message.message.imageMessage || message.message.imageMessage.mimetype != "image/jpeg") {
				conn.sendMessage(senderNumber, "No picture :)", MessageType.text, { quoted: message });
				break;
			}

			const image = await conn.downloadMediaMessage(message);
			const imageBase64 = image.toString("base64");

			const response = await axios.post("https://trace.moe/api/search", { "image":imageBase64 });
			const result = response.data.docs[0];

			const text = `Nama Anime : _${result.title_romaji}_\nSeason : _${result.season}_\nEpisode : _${result.episode}_\nAkurasi : _${result.similarity}_`
			conn.sendMessage(senderNumber, text, MessageType.text, { quoted: message });
			break;
		}

		case "!textsticker":
		case "!textstiker":
		{
			if (!parameter) {
				conn.sendMessage(senderNumber, "The input is wrong sir :)", MessageType.text, { quoted: message });
				break;
			}

			const response = await axios.post("https://salism3api.pythonanywhere.com/text2img", { "text":parameter.slice(0,60) });
			const sticker = new WSF.Sticker(response.data.image, { crop: false, pack: "github.com/salismazaya", author: conn.user.name });
			await sticker.build();
			const bufferImage = await sticker.get();
			conn.sendMessage(senderNumber, bufferImage, MessageType.sticker, { quoted: message });
			break;
		}

		case "!ocr":
		{
			if (quotedMessage) {
				message.message = quotedMessage;
			}

			if (!message.message.imageMessage || message.message.imageMessage.mimetype != "image/jpeg") {
				conn.sendMessage(senderNumber, "No picture :)", MessageType.text, { quoted: message });
				break;
			}
			const imagePath = await conn.downloadAndSaveMediaMessage(message, Math.floor(Math.random() * 1000000));
			const textImage = (await tesseract.recognize(imagePath)).trim();
			fs.unlinkSync(imagePath)

			conn.sendMessage(senderNumber, textImage, MessageType.text, { quoted: message });		
			break;
		}

		default:
		{
			if (!message.participant && !stickerMessage) conn.sendMessage(senderNumber, "Unregistered command, send *! Help * to see registered command", MessageType.text, { quoted: message });
		}

	}
}
