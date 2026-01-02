require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder, StringSelectMenuBuilder } = require('discord.js');
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
const TEMP_VOICE_CATEGORY_ID = '1442693890011304080';
const BOT_TOKEN = process.env.BOT_TOKEN;

let blockedUsers = {};
if (fs.existsSync('./block.json')) {
  blockedUsers = JSON.parse(fs.readFileSync('./block.json', 'utf8'));
} else {
  fs.writeFileSync('./block.json', JSON.stringify({}));
}

let tempVoiceChannels = {};

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
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('my_voice_settings')
        .setLabel('My Voice Settings')
        .setStyle(ButtonStyle.Secondary)
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

// Interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

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
        await interaction.reply({ content: `تم إضافة ${memberToAdd} للتيكت`, flags: 64 });
      } catch (error) {
        await interaction.reply({ content: 'فشل، تأكد من الآيدي', flags: 64 });
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
          parent: TEMP_VOICE_CATEGORY_ID,
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

        await interaction.reply({ content: `تم إنشاء ${voiceChannel}، ادخل خلال دقيقة`, flags: 64 });
      } catch (error) {
        await interaction.reply({ content: 'فشل إنشاء الروم', flags: 64 });
      }
      return;
    }

    if (interaction.customId === 'voice_rename_modal') {
      const newName = interaction.fields.getTextInputValue('new_voice_name');
      const userChannel = tempVoiceChannels[interaction.user.id];
      
      if (!userChannel) {
        return interaction.reply({ content: 'ليس لديك روم صوتي', flags: 64 });
      }

      const channel = interaction.guild.channels.cache.get(userChannel.id);
      if (!channel) {
        return interaction.reply({ content: 'الروم غير موجود', flags: 64 });
      }

      try {
        await channel.setName(newName);
        await interaction.reply({ content: `تم تغيير الاسم إلى: ${newName}`, flags: 64 });
      } catch (error) {
        await interaction.reply({ content: 'فشل تغيير الاسم', flags: 64 });
      }
      return;
    }

    if (interaction.customId === 'voice_limit_modal') {
      const newLimit = parseInt(interaction.fields.getTextInputValue('new_voice_limit')) || 0;
      const userChannel = tempVoiceChannels[interaction.user.id];
      
      if (!userChannel) {
        return interaction.reply({ content: 'ليس لديك روم صوتي', flags: 64 });
      }

      const channel = interaction.guild.channels.cache.get(userChannel.id);
      if (!channel) {
        return interaction.reply({ content: 'الروم غير موجود', flags: 64 });
      }

      try {
        await channel.setUserLimit(newLimit);
        await interaction.reply({ content: `تم تغيير الحد إلى: ${newLimit === 0 ? 'بدون حد' : newLimit}`, flags: 64 });
      } catch (error) {
        await interaction.reply({ content: 'فشل تغيير الحد', flags: 64 });
      }
      return;
    }
  }

  // Select Menu
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'kick_member_select') {
      const userChannel = tempVoiceChannels[interaction.user.id];
      if (!userChannel) {
        return interaction.reply({ content: 'ليس لديك روم صوتي', flags: 64 });
      }

      const channel = interaction.guild.channels.cache.get(userChannel.id);
      if (!channel) {
        return interaction.reply({ content: 'الروم غير موجود', flags: 64 });
      }

      const targetUserId = interaction.values[0];
      const member = await interaction.guild.members.fetch(targetUserId);
      
      try {
        await member.voice.disconnect();
        await interaction.reply({ content: `تم طرد ${member.user.username}`, flags: 64 });
      } catch (error) {
        await interaction.reply({ content: 'فشل الطرد', flags: 64 });
      }
      return;
    }
  }

  // Button Interactions
  if (interaction.isButton()) {
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

    // My Voice Settings
    if (interaction.customId === 'my_voice_settings') {
      const userChannel = tempVoiceChannels[interaction.user.id];
      
      if (!userChannel) {
        return interaction.reply({ content: 'ليس لديك روم صوتي حالي', flags: 64 });
      }

      const channel = interaction.guild.channels.cache.get(userChannel.id);
      if (!channel) {
        delete tempVoiceChannels[interaction.user.id];
        return interaction.reply({ content: 'الروم غير موجود', flags: 64 });
      }

      const members = Array.from(channel.members.values());
      const memberList = members.length > 0 
        ? members.map(m => `${m.user.username}`).join('\n')
        : 'لا يوجد أحد';

      const isLocked = channel.permissionOverwrites.cache.get(interaction.guild.id)?.deny.has(PermissionFlagsBits.Connect);

      const embed = new EmbedBuilder()
        .setTitle('Voice Settings')
        .setColor('#FFFFFF')
        .addFields(
          { name: 'الاسم', value: channel.name, inline: true },
          { name: 'الأشخاص', value: `${members.length}/${channel.userLimit || '∞'}`, inline: true },
          { name: 'الحالة', value: isLocked ? 'مقفل' : 'مفتوح', inline: true },
          { name: 'الأعضاء', value: memberList }
        );

      const row1 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('voice_lock')
            .setLabel('قفل')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('voice_unlock')
            .setLabel('فتح')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('voice_rename')
            .setLabel('تغيير الاسم')
            .setStyle(ButtonStyle.Secondary)
        );

      const row2 = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('voice_limit')
            .setLabel('تغيير الحد')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('voice_hide')
            .setLabel('إخفاء')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('voice_show')
            .setLabel('إظهار')
            .setStyle(ButtonStyle.Secondary)
        );

      const components = [row1, row2];

      if (members.length > 1) {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('kick_member_select')
          .setPlaceholder('اختر عضو لطرده')
          .addOptions(
            members
              .filter(m => m.user.id !== interaction.user.id)
              .map(m => ({
                label: m.user.username,
                value: m.user.id,
                description: `طرد ${m.user.username}`
              }))
          );

        const row3 = new ActionRowBuilder().addComponents(selectMenu);
        components.push(row3);
      }

      await interaction.reply({ embeds: [embed], components, flags: 64 });
      return;
    }

    // Voice Lock
    if (interaction.customId === 'voice_lock') {
      const userChannel = tempVoiceChannels[interaction.user.id];
      if (!userChannel) {
        return interaction.reply({ content: 'ليس لديك روم صوتي', flags: 64 });
      }

      const channel = interaction.guild.channels.cache.get(userChannel.id);
      if (!channel) {
        return interaction.reply({ content: 'الروم غير موجود', flags: 64 });
      }

      try {
        await channel.permissionOverwrites.edit(interaction.guild.id, {
          Connect: false
        });
        await interaction.reply({ content: 'تم قفل الروم', flags: 64 });
      } catch (error) {
        await interaction.reply({ content: 'فشل قفل الروم', flags: 64 });
      }
      return;
    }

    // Voice Unlock
    if (interaction.customId === 'voice_unlock') {
      const userChannel = tempVoiceChannels[interaction.user.id];
      if (!userChannel) {
        return interaction.reply({ content: 'ليس لديك روم صوتي', flags: 64 });
      }

      const channel = interaction.guild.channels.cache.get(userChannel.id);
      if (!channel) {
        return interaction.reply({ content: 'الروم غير موجود', flags: 64 });
      }

      try {
        await channel.permissionOverwrites.edit(interaction.guild.id, {
          Connect: null
        });
        await interaction.reply({ content: 'تم فتح الروم', flags: 64 });
      } catch (error) {
        await interaction.reply({ content: 'فشل فتح الروم', flags: 64 });
      }
      return;
    }

    // Voice Rename
    if (interaction.customId === 'voice_rename') {
      const modal = new ModalBuilder()
        .setCustomId('voice_rename_modal')
        .setTitle('تغيير اسم الروم');

      const nameInput = new TextInputBuilder()
        .setCustomId('new_voice_name')
        .setLabel('الاسم الجديد')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
      await interaction.showModal(modal);
      return;
    }

    // Voice Limit
    if (interaction.customId === 'voice_limit') {
      const modal = new ModalBuilder()
        .setCustomId('voice_limit_modal')
        .setTitle('تغيير حد الأشخاص');

      const limitInput = new TextInputBuilder()
        .setCustomId('new_voice_limit')
        .setLabel('الحد الجديد (0 = بدون حد)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('0')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
      await interaction.showModal(modal);
      return;
    }

    // Voice Hide
    if (interaction.customId === 'voice_hide') {
      const userChannel = tempVoiceChannels[interaction.user.id];
      if (!userChannel) {
        return interaction.reply({ content: 'ليس لديك روم صوتي', flags: 64 });
      }

      const channel = interaction.guild.channels.cache.get(userChannel.id);
      if (!channel) {
        return interaction.reply({ content: 'الروم غير موجود', flags: 64 });
      }

      try {
        await channel.permissionOverwrites.edit(interaction.guild.id, {
          ViewChannel: false
        });
        await interaction.reply({ content: 'تم إخفاء الروم', flags: 64 });
      } catch (error) {
        await interaction.reply({ content: 'فشل إخفاء الروم', flags: 64 });
      }
      return;
    }

    // Voice Show
    if (interaction.customId === 'voice_show') {
      const userChannel = tempVoiceChannels[interaction.user.id];
      if (!userChannel) {
        return interaction.reply({ content: 'ليس لديك روم صوتي', flags: 64 });
      }

      const channel = interaction.guild.channels.cache.get(userChannel.id);
      if (!channel) {
        return interaction.reply({ content: 'الروم غير موجود', flags: 64 });
      }

      try {
        await channel.permissionOverwrites.edit(interaction.guild.id, {
          ViewChannel: null
        });
        await interaction.reply({ content: 'تم إظهار الروم', flags: 64 });
      } catch (error) {
        await interaction.reply({ content: 'فشل إظهار الروم', flags: 64 });
      }
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

client.login(BOT_TOKEN);
