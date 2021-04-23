require('dotenv').config()
const knex = require('knex')
const { Telegraf, session } = require('telegraf')
const knexConfig = require('./knexfile')
const { BOT_USER, BOT_TOKEN, NEWS_GROUP } = process.env

const bot = new Telegraf(BOT_TOKEN, { username: BOT_USER })

bot.context.db = knex(knexConfig)
bot.use(session())
bot.use(async (ctx, next) => {
  if (!ctx.session) {
    ctx.session = {}
  }
  await next()
})

const saveUserToDb = async (db, ctxUser) => {
  let dbUser = await db('users')
    .where('id', Number(ctxUser.id))
    .first()
    .catch(console.error)

  if (dbUser) {
    const diff = Object.keys(ctxUser).reduce((acc, key) => {
      if (key === 'id') {
        return acc
      }
      if (typeof ctxUser[key] === 'boolean') {
        dbUser[key] = Boolean(dbUser[key])
      }
      if (ctxUser[key] !== dbUser[key]) {
        acc[key] = ctxUser[key]
      }
      return acc
    }, {})

    if (Object.keys(diff).length > 0) {
      await db('users')
        .where('id', Number(ctxUser.id))
        .update({ ...diff, updated_at: new Date() })
        .catch(console.error)
    }
    return
  }

  await db('users').insert(ctxUser).catch(console.error)
}

const userLink = ({
  id,
  username,
  first_name: firstName,
  last_name: lastName,
}) => username
  ? `@${username.replace(/([_*~])/g, '\\$1')}`
  : `[${firstName || lastName}](tg://user?id=${id})`

bot.use(async (ctx, next) => {
  await saveUserToDb(ctx.db, ctx.from)
  await next()
})

bot.on('new_chat_members', async (ctx) => {
  for (let i = 0; i < ctx.update.message.new_chat_members.length; i += 1) {
    const member = ctx.message.new_chat_members[i]
    const message = await ctx.replyWithMarkdown(`Приветствую ${userLink(member)}

✅ Данная группа создана для более быстрого и слаженного взаимодействия собственников ЖК "СОКОЛ ГРАДъ".  ✅

❗️ Небольшие правила: ❗️
- Уважаем себя и других.
- Не спамим сообщениями/стикерами/картинками.
- Не приветствуется мат.
- Запрещена реклама

🔑⚠️Просим Вам зарегестрироваться в системе для определения вашего статуса в группе. Команда /reg🔑⚠️

📣 Новостная группа 📣
${NEWS_GROUP}`).catch(console.error)

    setTimeout(() => {
      ctx.deleteMessage(message.message_id).catch(console.error)
    }, 180000)
  }
})

bot.command('reg', async (ctx) => {
  if (ctx.session.reg) {
    await ctx.deleteMessage(ctx.session.reg).catch(console.error)
  }

  const reg = await ctx.db('regs')
    .where('user_id', ctx.from.id)
    .first()
    .catch(console.error)
  let message

  if (reg) {
    const flat = await ctx.db('regs')
      .select('liter', 'entrance', 'number')
      .join('flats', 'regs.flat_id', '=', 'flats.id')
      .where('regs.user_id', ctx.from.id)
      .orderBy('regs.created_at', 'desc')
      .first()
      .catch(console.error)

    message = await ctx.reply(`${userLink(ctx.from)}, у вас уже есть регистрация!

Литер №${flat.liter}
Подъезд №${flat.entrance}
Квартира №${flat.number}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Удалить', callback_data: 'delete' }],
          [{ text: 'Отмена', callback_data: 'cancel' }],
        ],
      },
    }).catch(console.error)
  } else {
    message = await ctx.reply(`${userLink(ctx.from)}, выберите ваш статус:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Собственник', callback_data: 'reg' }],
          [{ text: 'Гость', callback_data: 'guest' }],
          [{ text: 'Отмена', callback_data: 'cancel' }],
        ],
      },
    }).catch(console.error)
  }

  ctx.session.reg = message.message_id
})

bot.action('delete', async (ctx) => {
  await ctx.db('regs')
    .where('user_id', ctx.from.id)
    .delete()

  const message = await ctx.editMessageText(`${userLink(ctx.from)}, выберите ваш статус:`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Собственник', callback_data: 'reg' }],
        [{ text: 'Гость', callback_data: 'guest' }],
        [{ text: 'Отмена', callback_data: 'cancel' }],
      ],
    },
  }).catch(console.error)

  ctx.session.reg = message.message_id
})

bot.action('cancel', async (ctx) => {
  if (!ctx.session.reg || ctx.session.reg !== ctx.update.callback_query.message.message_id) {
    await ctx.answerCbQuery('Это не ваша регистрация, чтобы начать свою отправьте команду /reg')
      .catch(console.error)
    return
  }

  await ctx.deleteMessage(ctx.session.reg).catch(console.error)
  ctx.session.reg = null
})

bot.action('begin', async (ctx) => {
  if (!ctx.session.reg || ctx.session.reg !== ctx.update.callback_query.message.message_id) {
    await ctx.answerCbQuery('Это не ваша регистрация, чтобы начать свою отправьте команду /reg')
      .catch(console.error)
    return
  }

  ctx.editMessageText(`${userLink(ctx.from)}, выберите ваш статус:`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Собственник', callback_data: 'reg' }],
        [{ text: 'Гость', callback_data: 'guest' }],
        [{ text: 'Отмена', callback_data: 'cancel' }],
      ],
    },
  }).catch(console.error)
})

bot.action('reg', async (ctx) => {
  if (!ctx.session.reg || ctx.session.reg !== ctx.update.callback_query.message.message_id) {
    await ctx.answerCbQuery('Это не ваша регистрация, чтобы начать свою отправьте команду /reg')
      .catch(console.error)
    return
  }

  const liters = await ctx.db('flats')
    .select('liter')
    .groupBy('liter')
    .catch(console.error)

  const litersButtons = liters.reduce((acc, { liter }, idx) => {
    const index = parseInt(idx / 2)
    acc[index] = acc[index] || []
    acc[index].push({
      text: `Литер ${liter}`,
      callback_data: `liter${liter}`,
    })
    return acc
  }, [])

  ctx.editMessageText(`${userLink(ctx.from)}, выберите ваш корпус:`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        ...litersButtons,
        [{ text: 'Выбрать другой статус', callback_data: 'begin' }],
      ],
    },
  }).catch(console.error)
})

bot.action(/^liter(\d)$/, async (ctx) => {
  if (!ctx.session.reg || ctx.session.reg !== ctx.update.callback_query.message.message_id) {
    await ctx.answerCbQuery('Это не ваша регистрация, чтобы начать свою отправьте команду /reg')
      .catch(console.error)
    return
  }

  const entrances = await ctx.db('flats')
    .select(
      'entrance',
      ctx.db.raw('CONCAT(MIN(number), \'-\', MAX(number)) AS flats')
    )
    .where('liter', ctx.match[1])
    .groupBy('entrance')
    .catch(console.error)

  ctx.editMessageText(`${userLink(ctx.from)}, вами выбрано:
- Литер ${ctx.match[1]}

Выберите ваш подъезд:`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        ...entrances.map(({ entrance, flats }) => [{
          text: `Подъезд №${entrance}, квартиры ${flats}`,
          callback_data: `liter${ctx.match[1]},entrance${entrance}`,
        }]),
        [{ text: 'Выбрать другой корпус', callback_data: `reg` }],
      ],
    },
  }).catch(console.error)
})

bot.action(/^liter(\d),entrance(\d)$/, async (ctx) => {
  if (!ctx.session.reg || ctx.session.reg !== ctx.update.callback_query.message.message_id) {
    await ctx.answerCbQuery('Это не ваша регистрация, чтобы начать свою отправьте команду /reg')
      .catch(console.error)
    return
  }

  const floors = await ctx.db('flats')
    .select(
      'floor',
      ctx.db.raw('CONCAT(MIN(number), \'-\', MAX(number)) AS flats')
    )
    .where({
      liter: ctx.match[1],
      entrance: ctx.match[2],
    })
    .groupBy('floor')
    .catch(console.error)

  ctx.editMessageText(`${userLink(ctx.from)}, вами выбрано:
- Литер ${ctx.match[1]}
- Подъезд ${ctx.match[2]}

Выберите ваш этаж:`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        ...floors.map(({ floor, flats }) => [{
          text: `Этаж №${floor}, квартиры ${flats}`,
          callback_data: `liter${ctx.match[1]},entrance${ctx.match[2]},floor${floor}`,
        }]),
        [{
          text: 'Выбрать другой подъезд',
          callback_data: `liter${ctx.match[1]}`,
        }],
        [{
          text: 'Выбрать другой корпус',
          callback_data: `reg`,
        }],
      ],
    },
  }).catch(console.error)
})

bot.action(/^liter(\d),entrance(\d),floor(\d+)$/, async (ctx) => {
  if (!ctx.session.reg || ctx.session.reg !== ctx.update.callback_query.message.message_id) {
    await ctx.answerCbQuery('Это не ваша регистрация, чтобы начать свою отправьте команду /reg')
      .catch(console.error)
    return
  }

  const flats = await ctx.db('flats')
    .select('id', 'number')
    .where({
      liter: ctx.match[1],
      entrance: ctx.match[2],
      floor: ctx.match[3],
    })
    .catch(console.error)

  const flatsButtons = flats.reduce((acc, { id, number }, idx) => {
    const index = parseInt(idx / 4)
    acc[index] = acc[index] || []
    acc[index].push({
      text: number,
      callback_data: `register${id}`,
    })
    return acc
  }, [])

  ctx.editMessageText(`${userLink(ctx.from)}, вами выбрано:
- Литер ${ctx.match[1]}
- Подъезд ${ctx.match[2]}
- Этаж ${ctx.match[3]}

Выберите вашу квартиру:`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        ...flatsButtons,
        [{
          text: 'Выбрать другой этаж',
          callback_data: `liter${ctx.match[1]},entrance${ctx.match[2]}`,
        }],
        [{
          text: 'Выбрать другой подъезд',
          callback_data: `liter${ctx.match[1]}`,
        }],
        [{
          text: 'Выбрать другой корпус',
          callback_data: `reg`,
        }],
      ],
    },
  }).catch(console.error)
})

bot.action(/^register(\d+)$/, async (ctx) => {
  if (!ctx.session.reg || ctx.session.reg !== ctx.update.callback_query.message.message_id) {
    await ctx.answerCbQuery('Это не ваша регистрация, чтобы начать свою отправьте команду /reg')
      .catch(console.error)
    return
  }

  const reg = { user_id: ctx.from.id, flat_id: ctx.match[1] }

  await ctx.db('regs').insert(reg).catch(console.error)

  const flat = await ctx.db('regs')
    .select('liter', 'entrance', 'number')
    .join('flats', 'regs.flat_id', '=', 'flats.id')
    .where('regs.user_id', ctx.from.id)
    .orderBy('regs.created_at', 'desc')
    .first()
    .catch(console.error)

  ctx.editMessageText(`Поздравляем ${userLink(ctx.from)}, вы успешно зарегистрированны по адресу:

СОКОЛ-ГРАДъ
Литер №${flat.liter}
Подъезд №${flat.entrance}
Квартира №${flat.number}

Спасибо за регистрацию!`, {
  parse_mode: 'Markdown',
}).catch(console.error)

  setTimeout(() => {
    ctx.deleteMessage(ctx.session.reg).catch(console.error)
    ctx.session.reg = null
  }, 20000)
})

bot.command('count', async (ctx) => {
  const count = await ctx.db('regs').count().catch(console.error)
  console.log(count)

  ctx.reply(`Всего зарегистрированно ${count[0]['count(*)']} жильцов.`)
})

bot.hears(/желто.*синий/i, async (ctx) => {
  ctx.reply('Самый сильный!!!')
})

bot.launch()

