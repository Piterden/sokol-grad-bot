exports.up = async (knex) => {
  if (!await knex.schema.hasTable('flats')) {
    return knex.schema.createTable('flats', (table) => {
      table.increments('id')
      table.integer('number').unsigned()
      table.tinyint('liter').unsigned()
      table.tinyint('entrance').unsigned()
      table.tinyint('floor').unsigned()
      table.decimal('square')
      table.tinyint('rooms').unsigned()

      table.unique(['number', 'liter'])
    })
  }
  return null
}

exports.down = async (knex) => {
  if (await knex.schema.hasTable('flats')) {
    return knex.schema.dropTable('flats')
  }
  return null
}
