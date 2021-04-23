exports.up = async (knex) => {
  if (!await knex.schema.hasTable('regs')) {
    return knex.schema.createTable('regs', (table) => {
      table.increments('id')
      table.biginteger('user_id')
        .unsigned()
        .notNullable()
        .index()
        .references('id')
        .inTable('users')
      table.integer('flat_id')
        .unsigned()
        .notNullable()
        .index()
        .references('id')
        .inTable('flats')
      table.timestamp('created_at').defaultTo(knex.fn.now())
    })
  }
  return null
}

exports.down = async (knex) => {
  if (await knex.schema.hasTable('regs')) {
    return knex.schema.dropTable('regs')
  }
  return null
}
