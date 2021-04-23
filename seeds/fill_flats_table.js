const fs = require('fs')
const path = require('path')

const files = fs.readdirSync(path.join(__dirname, 'flats'))
const rows = []

for (let i = 0; i < files.length; i += 1) {
  const file = files[i]
  const [, num] = file.match(/(\d)\.json$/)
  const flats = require(path.join(__dirname, 'flats', file))

  for (let j = 0; j < flats.length; j += 1) {
    rows.push({
      number: flats[j]["No"],
      liter: num,
      entrance: flats[j]["Номер подъезда"],
      floor: flats[j]["Этаж"],
      square: Number(flats[j]["Общая площадь (м2)"].replace(',', '.')),
      rooms: flats[j]["Кол-во комнат"],
    })
  }
}

exports.seed = async (knex) => {
  await knex('flats').del()
  await knex('flats').insert(rows)
  // console.log(rows)
}
