require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder, REST, Routes } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const VERIFICATION_CHANNEL_ID = '1454048516266528768';
const APPROVAL_CHANNEL_ID = '1456634920092045498';
const VERIFIED_ROLE_ID = '1446859259840036924';
const ADMIN_ROLE_1 = '1455684787804307590';
const ADMIN_ROLE_2 = '1442691051990024435';
const TICKET_CATEGORY_ID = '1442694124745523381';
const VOICE_CHANNEL_ID = '1454050373332635773';
const TICKET_MANAGER_ROLE_1 = '1442693522833670326';
const TICKET_MANAGER_ROLE_2 = '1442693348006695112';
const TICKET_MANAGER_ROLE_3 = '1442693104267296839';
const VOICE_DASHBOARD_CHANNEL_ID = '1456741789481435189';
const BOT_TOKEN = process.env.BOT_TOKEN;

let blockedUsers = {};
if (fs.existsSync('./block.json')) {
  blockedUsers = JSON.parse(fs.readFileSync('./block.json', 'utf8'));
} else {
  fs.writeFileSync('./block.json', JSON.stringify({}));
}

let giveaways = {};
let tempVoiceChannels = {};
let fakeParticipants = 0;

function saveBlockedUsers() {
  fs.writeFileSync('./block.json', JSON.stringify(blockedUsers, null, 2));
}

client.on('ready', async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  
  client.user.setPresence({
    activities: [{ name: '.gg/408', type: 3 }],
    status: 'idle'
  });
  
  console.log('✅ تم تعيين حالة البوت: Watching .gg/408');
  
  // تسجيل الأوامر
  const commands = [
    {
      name: 'gstart',
      description: 'Start a giveaway',
      options: [
        { name: 'duration', description: 'Duration (e.g., 1h, 30m, 1d)', type: 3, required: true },
        { name: 'winners', description: 'Number of winners', type: 4, required: true },
        { name: 'prize', description: 'Prize description', type: 3, required: true }
      ]
    }
  ];

  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('✅ تم تسجيل الأوامر');
  } catch (error) {
    console.error('❌ خطأ في تسجيل الأوامر:', error);
  }
  
  joinVoiceChannelFunc();
  sendVerificationMessage();
  setupVoiceDashboard();
});

// إرسال رسالة التفعيل كل 3 ساعات
async function sendVerificationMessage() {
  const channel = client.channels.cache.get(VERIFICATION_CHANNEL_ID);
  if (!channel) return;

  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    const botMessages = messages.filter(m => m.author.id === client.user.id);
    if (botMessages.size > 0) {
      await channel.bulkDelete(botMessages);
    }
  } catch (e) {
    console.error('خطأ في حذف الرسائل:', e);
  }

  await channel.send('**للتفعيل نقط بالروم**\n```\n.\n```\n@everyone @here');
  setTimeout(sendVerificationMessage, 3 * 60 * 60 * 1000);
}

// Voice Dashboard
async function setupVoiceDashboard() {
  const channel = client.channels.cache.get(VOICE_DASHBOARD_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('Voice Dashboard')
    .setDescription('Create and manage your temporary voice channels')
    .setColor('#FFFFFF');

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('create_voice')
        .setLabel('Create Voice')
        .setStyle(ButtonStyle.Primary)
    );

  await channel.send({ embeds: [embed], components: [row] });
}

function joinVoiceChannelFunc() {
  try {
    const channel = client.channels.cache.get(VOICE_CHANNEL_ID);
    if (!channel) {
      console.error('❌ الروم الصوتي غير موجود!');
      return;
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    console.log(`✅ تم الدخول للروم الصوتي: ${channel.name}`);

    connection.on('stateChange', (oldState, newState) => {
      if (newState.status === 'disconnected') {
        console.log('⚠️ تم قطع الاتصال، جاري إعادة الاتصال...');
        setTimeout(() => joinVoiceChannelFunc(), 3000);
      }
    });
  } catch (error) {
    console.error('❌ خطأ في الدخول للروم الصوتي:', error);
    setTimeout(() => joinVoiceChannelFunc(), 5000);
  }
}

client.on('voiceStateUpdate', async (oldState, newState) => {
  // إعادة دخول البوت
  if (newState.id === client.user.id) {
    if (oldState.channelId === VOICE_CHANNEL_ID && newState.channelId !== VOICE_CHANNEL_ID) {
      console.log('⚠️ تم طرد البوت، جاري إعادة الدخول...');
      setTimeout(() => joinVoiceChannelFunc(), 2000);
    }
  }

  // إدارة الرومات المؤقتة
  const userId = newState.id;
  
  if (tempVoiceChannels[userId]) {
    const tempChannel = tempVoiceChannels[userId];
    
    if (newState.channelId === tempChannel.id) {
      if (tempChannel.deleteTimeout) {
        clearTimeout(tempChannel.deleteTimeout);
        tempChannel.deleteTimeout = null;
      }
    }
    
    if (oldState.channelId === tempChannel.id && newState.channelId !== tempChannel.id) {
      const channel = client.channels.cache.get(tempChannel.id);
      if (channel && channel.members.size === 0) {
        tempChannel.deleteTimeout = setTimeout(async () => {
          try {
            await channel.delete();
            delete tempVoiceChannels[userId];
          } catch (e) {}
        }, 15000);
      }
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // حذف الرسائل في روم التفعيل
  if (message.channel.id === VERIFICATION_CHANNEL_ID) {
    const hasPermission = message.member.roles.cache.has(ADMIN_ROLE_1) || 
                         message.member.roles.cache.has(ADMIN_ROLE_2) ||
                         message.member.roles.cache.has(TICKET_MANAGER_ROLE_2);
    
    if (!hasPermission && message.content.trim() !== '.') {
      return message.delete().catch(() => {});
    }
  }

  // الردود التلقائية
  if (message.content.toLowerCase().includes('السلام عليكم')) {
    return message.reply('و عليكم السلام و الرحمه ارحب منور');
  }

  // أمر countset
  if (message.content.startsWith('-countset')) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('❌ هذا الأمر للأدمنز فقط!');
    }

    const count = parseInt(message.content.split(' ')[1]);
    if (isNaN(count)) {
      return message.reply('❌ يجب كتابة رقم صحيح!');
    }

    fakeParticipants = count;
    return message.reply(`✅ تم تعيين العدد الوهمي إلى ${count}`);
  }

  // أمر الحظر
  if (message.content.startsWith('-block')) {
    const hasPermission = message.member.roles.cache.has(ADMIN_ROLE_1) || message.member.roles.cache.has(ADMIN_ROLE_2);
    if (!hasPermission) return message.reply('❌ ليس لديك صلاحية!');

    const mentionedUser = message.mentions.users.first();
    if (!mentionedUser) return message.reply('❌ منشن الشخص!');

    blockedUsers[mentionedUser.id] = true;
    saveBlockedUsers();
    return message.reply(`✅ تم حظر ${mentionedUser} من التيكتات!`);
  }

  if (message.content.startsWith('-unblock')) {
    const hasPermission = message.member.roles.cache.has(ADMIN_ROLE_1) || message.member.roles.cache.has(ADMIN_ROLE_2);
    if (!hasPermission) return message.reply('❌ ليس لديك صلاحية!');

    const mentionedUser = message.mentions.users.first();
    if (!mentionedUser) return message.reply('❌ منشن الشخص!');

    delete blockedUsers[mentionedUser.id];
    saveBlockedUsers();
    return message.reply(`✅ تم إلغاء حظر ${mentionedUser}!`);
  }

  if (message.content === '!setup-ticket' && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    const attachment = new AttachmentBuilder('./man.jpg');
    const embed = new EmbedBuilder()
      .setColor('#FFFFFF')
      .setDescription('**Ticket Support**')
      .setImage('attachment://man.jpg');

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('open_ticket')
          .setLabel('Open')
          .setStyle(ButtonStyle.Secondary)
      );

    await message.channel.send({ embeds: [embed], components: [row], files: [attachment] });
    await message.delete();
    return;
  }

  // نظام التفعيل
  if (message.channel.id !== VERIFICATION_CHANNEL_ID) return;
  if (message.content.trim() !== '.') return;

  try {
    const member = message.member;
    const role = message.guild.roles.cache.get(VERIFIED_ROLE_ID);
    if (!role) {
      console.error('❌ الرول غير موجود!');
      return;
    }

    if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
      await message.react('❌');
      setTimeout(() => message.delete().catch(() => {}), 3000);
      return;
    }

    await message.delete();
    try {
      await member.send('**تفعيلك بالانتظار ⏳**\n**The great\'s**');
    } catch (e) {
      console.error('❌ لا يمكن إرسال رسالة خاصة للعضو');
    }

    const approvalChannel = message.guild.channels.cache.get(APPROVAL_CHANNEL_ID);
    if (!approvalChannel) {
      console.error('❌ روم الموافقات غير موجود!');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🔔 طلب تفعيل جديد')
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '👤 الاسم', value: member.user.displayName, inline: true },
        { name: '🏷️ اليوزر', value: `@${member.user.username}`, inline: true },
        { name: '📋 المنشن', value: `${member}`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `User ID: ${member.user.id}` });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_${member.user.id}`)
          .setLabel('✅ قبول')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_${member.user.id}`)
          .setLabel('❌ رفض')
          .setStyle(ButtonStyle.Danger)
      );

    await approvalChannel.send({ embeds: [embed], components: [row] });
    console.log(`✅ تم إرسال طلب التفعيل للعضو: ${member.user.tag}`);
  } catch (error) {
    console.error('❌ حدث خطأ:', error);
  }
});

// Slash Commands & Interactions
client.on('interactionCreate', async (interaction) => {
  // Slash Commands
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'gstart') {
      const duration = interaction.options.getString('duration');
      const winners = interaction.options.getInteger('winners');
      const prize = interaction.options.getString('prize');

      const timeMs = parseDuration(duration);
      if (!timeMs) return interaction.reply({ content: '❌ صيغة الوقت خاطئة! استخدم (1h, 30m, 1d)', flags: 64 });

      const endTime = Date.now() + timeMs;
      const giveawayId = `giveaway_${Date.now()}`;

      giveaways[giveawayId] = {
        prize,
        host: interaction.user.id,
        winners,
        participants: [],
        endTime,
        messageId: null,
        channelId: interaction.channel.id
      };

      const embed = new EmbedBuilder()
        .setColor('#FFFFFF')
        .setTitle(prize)
        .addFields(
          { name: 'من', value: `${interaction.user}`, inline: true },
          { name: 'الفائزين', value: `${winners}`, inline: true },
          { name: 'ينتهي', value: `<t:${Math.floor(endTime / 1000)}:R>`, inline: true }
        );

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`join_${giveawayId}`)
            .setLabel('مشاركة')
            .setStyle(ButtonStyle.Primary)
        );

      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
      giveaways[giveawayId].messageId = msg.id;

      setTimeout(() => endGiveaway(giveawayId), timeMs);
    }
    return;
  }

  if (!interaction.isButton() && !interaction.isModalSubmit()) return;

  // Modal Submissions
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'add_member_modal') {
      const userId = interaction.fields.getTextInputValue('user_id');
      try {
        const memberToAdd = await interaction.guild.members.fetch(userId);
        await interaction.channel.permissionOverwrites.create(memberToAdd, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });
        await interaction.reply({ content: `✅ تم إضافة ${memberToAdd} للتيكت!` });
      } catch (error) {
        await interaction.reply({ content: '❌ فشل! تأكد من الآيدي.', flags: 64 });
      }
      return;
    }

    if (interaction.customId === 'voice_modal') {
      const name = interaction.fields.getTextInputValue('voice_name');
      const limit = parseInt(interaction.fields.getTextInputValue('voice_limit')) || 0;

      try {
        const voiceChannel = await interaction.guild.channels.create({
          name: name,
          type: ChannelType.GuildVoice,
          userLimit: limit > 0 ? limit : 0,
          permissionOverwrites: [
            { id: interaction.user.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ManageChannels] }
          ]
        });

        tempVoiceChannels[interaction.user.id] = {
          id: voiceChannel.id,
          deleteTimeout: setTimeout(async () => {
            try {
              await voiceChannel.delete();
              delete tempVoiceChannels[interaction.user.id];
            } catch (e) {}
          }, 60000)
        };

        await interaction.reply({ content: `✅ تم إنشاء ${voiceChannel}! ادخل خلال دقيقة!`, flags: 64 });
      } catch (error) {
        await interaction.reply({ content: '❌ فشل إنشاء الروم!', flags: 64 });
      }
      return;
    }
  }

  // Button Interactions
  if (interaction.isButton()) {
    // Giveaway Join
    if (interaction.customId.startsWith('join_')) {
      const giveawayId = interaction.customId.replace('join_', '');
      const giveaway = giveaways[giveawayId];
      
      if (!giveaway) return interaction.reply({ content: '❌ القيف غير موجود!', flags: 64 });

      if (giveaway.participants.includes(interaction.user.id)) {
        return interaction.reply({ content: '✅ أنت مشارك بالفعل!', flags: 64 });
      }

      giveaway.participants.push(interaction.user.id);
      return interaction.reply({ content: '✅ تم تسجيلك في القيف!', flags: 64 });
    }

    // Create Voice
    if (interaction.customId === 'create_voice') {
      const modal = new ModalBuilder()
        .setCustomId('voice_modal')
        .setTitle('إنشاء روم صوتي');

      const nameInput = new TextInputBuilder()
        .setCustomId('voice_name')
        .setLabel('اسم الروم')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const limitInput = new TextInputBuilder()
        .setCustomId('voice_limit')
        .setLabel('أقصى عدد أشخاص (0 = بدون حد)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('0')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(limitInput)
      );

      await interaction.showModal(modal);
      return;
    }

    // Ticket System
    if (interaction.customId === 'open_ticket') {
      await interaction.deferReply({ flags: 64 });

      try {
        const guild = interaction.guild;
        const member = interaction.member;
        
        if (blockedUsers[member.id]) {
          return interaction.editReply({ content: '❌ أنت محظور!', flags: 64 });
        }
        
        const existingTicket = guild.channels.cache.find(
          ch => ch.name === `${member.user.username}-ticket` && ch.parentId === TICKET_CATEGORY_ID
        );

        if (existingTicket) {
          return interaction.editReply({ content: '❌ لديك تيكت مفتوح!', flags: 64 });
        }

        const ticketChannel = await guild.channels.create({
          name: `${member.user.username}-ticket`,
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_ID,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: ADMIN_ROLE_1, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: ADMIN_ROLE_2, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: TICKET_MANAGER_ROLE_1, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: TICKET_MANAGER_ROLE_2, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: TICKET_MANAGER_ROLE_3, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
          ]
        });

        const ticketAttachment = new AttachmentBuilder('./man.jpg');
        const ticketEmbed = new EmbedBuilder().setColor('#FFFFFF').setImage('attachment://man.jpg');
        const ticketRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('add_member').setLabel('Add Member').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('call_owner').setLabel('Call Owner').setStyle(ButtonStyle.Secondary)
          );

        await ticketChannel.send({ content: `${member}`, embeds: [ticketEmbed], components: [ticketRow], files: [ticketAttachment] });
        await interaction.editReply({ content: `✅ ${ticketChannel}`, flags: 64 });
      } catch (error) {
        await interaction.editReply({ content: '❌ خطأ!', flags: 64 });
      }
      return;
    }

    if (interaction.customId === 'close_ticket') {
      const hasPermission = interaction.member.roles.cache.has(ADMIN_ROLE_1) || 
                           interaction.member.roles.cache.has(ADMIN_ROLE_2) ||
                           interaction.member.roles.cache.has(TICKET_MANAGER_ROLE_1) ||
                           interaction.member.roles.cache.has(TICKET_MANAGER_ROLE_2) ||
                           interaction.member.roles.cache.has(TICKET_MANAGER_ROLE_3);
      
      if (!hasPermission) return interaction.reply({ content: '❌ لا صلاحية!', flags: 64 });
      await interaction.reply({ content: '⏳ جاري الإغلاق...' });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
      return;
    }

    if (interaction.customId === 'add_member') {
      const hasPermission = interaction.member.roles.cache.has(ADMIN_ROLE_1) || 
                           interaction.member.roles.cache.has(ADMIN_ROLE_2) ||
                           interaction.member.roles.cache.has(TICKET_MANAGER_ROLE_1) ||
                           interaction.member.roles.cache.has(TICKET_MANAGER_ROLE_2) ||
                           interaction.member.roles.cache.has(TICKET_MANAGER_ROLE_3);
      
      if (!hasPermission) return interaction.reply({ content: '❌ لا صلاحية!', flags: 64 });

      const modal = new ModalBuilder().setCustomId('add_member_modal').setTitle('إضافة عضو');
      const userIdInput = new TextInputBuilder().setCustomId('user_id').setLabel('آيدي العضو').setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(userIdInput));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === 'call_owner') {
      await interaction.deferReply();
      const owner = await interaction.guild.fetchOwner();
      await interaction.editReply({ content: `${owner} تم استدعاؤك!` });
      return;
    }

    // Verification Buttons
    const hasPermission = interaction.member.roles.cache.has(ADMIN_ROLE_1) || interaction.member.roles.cache.has(ADMIN_ROLE_2);
    if (!hasPermission) return interaction.reply({ content: '❌ لا صلاحية!', flags: 64 });

    await interaction.deferUpdate();
    const [action, userId] = interaction.customId.split('_');
    const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!targetMember) return interaction.followUp({ content: '❌ العضو غير موجود!', flags: 64 });

    try {
      if (action === 'approve') {
        await targetMember.roles.add(VERIFIED_ROLE_ID);
        try {
          await targetMember.send('**تم تفعيلك بالسيرفر بنجاح <:2613verifiedwhitealternative:1456630238699196573>**\n**The great\'s**');
        } catch (e) {}

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor('#57F287')
          .addFields({ name: '✅ النتيجة', value: `تم القبول بواسطة ${interaction.user}` });

        const disabledRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder().setCustomId('approved').setLabel('✅ تم القبول').setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId('rejected').setLabel('❌ رفض').setStyle(ButtonStyle.Danger).setDisabled(true)
          );

        await interaction.editReply({ embeds: [updatedEmbed], components: [disabledRow] });
      } else if (action === 'reject') {
        try {
          await targetMember.send('**تم رفض طلب تفعيلك ❌**\n**The great\'s**');
        } catch (e) {}

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor('#ED4245')
          .addFields({ name: '❌ النتيجة', value: `تم الرفض بواسطة ${interaction.user}` });

        const disabledRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder().setCustomId('approved').setLabel('✅ قبول').setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId('rejected').setLabel('❌ تم الرفض').setStyle(ButtonStyle.Danger).setDisabled(true)
          );

        await interaction.editReply({ embeds: [updatedEmbed], components: [disabledRow] });
      }
    } catch (error) {
      console.error('❌ خطأ:', error);
    }
  }
});

function parseDuration(str) {
  const match = str.match(/^(\d+)(h|m|d|s)$/);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[unit];
}

async function endGiveaway(giveawayId) {
  const giveaway = giveaways[giveawayId];
  if (!giveaway) return;

  const channel = client.channels.cache.get(giveaway.channelId);
  if (!channel) return;

  if (giveaway.participants.length < giveaway.winners) {
    await channel.send('❌ لا يوجد مشاركين كافيين في القيف!');
    delete giveaways[giveawayId];
    return;
  }

  const shuffled = [...giveaway.participants].sort(() => Math.random() - 0.5);
  const winners = shuffled.slice(0, giveaway.winners);

  const embed = new EmbedBuilder()
    .setColor('#FFFFFF')
    .setTitle('🎉 انتهى القيف!')
    .setDescription(`**الجائزة:** ${giveaway.prize}\n**الفائزون:** ${winners.map(w => `<@${w}>`).join(', ')}`);

  await channel.send({ embeds: [embed] });
  delete giveaways[giveawayId];
}

client.login(BOT_TOKEN);

