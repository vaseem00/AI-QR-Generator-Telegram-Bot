const { Telegraf, Markup } = require('telegraf');
const QRCode = require('qrcode');
const { Worker } = require('worker_threads');   
const fs = require('fs');

const LocalSession = require('telegraf-session-local');


const channelId = "@channel_username"; // replace with your channel id

const bot = new Telegraf('YOUR_TOKEN'); // replace with your bot token
bot.use(new LocalSession({ database: 'session_db.json' }).middleware());

const qrCodeStyles = ['Digital Art', 'Cyberpunk', 'Painting', 'Normal'];

// Helper function to check if the user is subscribed
async function checkSubscription(ctx) {
  const userId = ctx.from.id;
  try {
    const member = await bot.telegram.getChatMember(channelId, userId);
    return ['creator', 'administrator', 'member'].includes(member.status);
  } catch (e) {
    console.log(e);
    return false;
  }
}

bot.start(async (ctx) => {
  //throw new Error('Example error1')
  if (await checkSubscription(ctx)) {
    ctx.reply(
      'Welcome to the QR Code Generator Bot! Please choose a QR code style:',
      Markup.inlineKeyboard(
        qrCodeStyles.map((style) => Markup.button.callback(style, 'QR_STYLE_' + style))
      ).resize()
    );
  } else {
    ctx.reply(
      `Please subscribe to our channel first to use this bot.`,
      Markup.inlineKeyboard([
        Markup.button.url('Subscribe', 't.me/python_gpt')
      ])
    );
  }
});

bot.action(/QR_STYLE_(.+)/, async (ctx) => {
  
  if (await checkSubscription(ctx)) {
    const [, style] = ctx.match;

    await ctx.answerCbQuery();
    await ctx.reply(`You've selected ${style}. Please enter the content for your QR code:`);
    ctx.session.style = style;
    ctx.session.step = 'content';
  } else {
    ctx.reply(
      `Please subscribe to our channel to use this bot.`,
      Markup.inlineKeyboard([
        Markup.button.url('Subscribe', channelId)
      ])
    );
  }
});

bot.on('text', async (ctx) => {
  
  if (await checkSubscription(ctx)) {
    if (ctx.session.step === 'content') {
      ctx.session.content = ctx.message.text;
      await ctx.reply('Now please enter the image prompt:');
      ctx.session.step = 'prompt';
    } else if (ctx.session.step === 'prompt') {
      ctx.session.prompt = ctx.message.text;
      ctx.session.step = 'processing';
      const generatingMessage = await ctx.reply('Generating your QR code...');

      const worker = new Worker('./worker.js');
      worker.postMessage({ content: ctx.session.content, prompt: ctx.session.prompt, style: ctx.session.style });
      worker.on('message', async (qrCodeImage) => {
        if (qrCodeImage.error) {
          await ctx.reply(`Error generating QR code: ${qrCodeImage.error}`);
        } else {
          await ctx.replyWithPhoto(qrCodeImage, { caption: ctx.session.prompt });
          await bot.telegram.deleteMessage(ctx.chat.id, generatingMessage.message_id);
        }
      
        ctx.session.step = null;
        ctx.session.content = null;
        ctx.session.prompt = null;
      });

      worker.on('error', (err) => {
        console.error('Worker encountered an error:', err);
        ctx.reply('Sorry, an error occurred while generating your QR code. Please try again.');
      });
      
      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`Worker stopped with exit code ${code}`);
          ctx.reply('Sorry, an error occurred while generating your QR code. Please try again.');
        }
      });
    } 
    else if (ctx.session.step !== 'processing') {
      await ctx.reply('Please use the /start command to begin.');
    }
  } 
  
  
  else {
    ctx.reply(
      `Please subscribe to our channel ${channelId} first to use this bot.`,
      Markup.inlineKeyboard([
        Markup.button.url('Subscribe', 't.me/python_gpt')
      ])
    );
  }
});

bot.command('cancel', async (ctx) => {
  if (['content', 'prompt'].includes(ctx.session.step)) {
    ctx.session.step = null;
    ctx.session.content = null;
    ctx.session.prompt = null;
    ctx.session.style = null;
    ctx.reply('The operation has been canceled. Please use the /start command to begin again.');
  } else {
    ctx.reply('No operation is currently ongoing.');
  }
});

bot.launch();
