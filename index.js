require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
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
const BOT_TOKEN = process.env.BOT_TOKEN;

// تحميل أو إنشاء ملف الحظر
let blockedUsers = {};
if (fs.existsSync('./block.json')) {
  blockedUsers = JSON.parse(fs.readFileSync('./block.json', 'utf8'));
} else {
  fs.writeFileSync('./block.json', JSON.stringify({}));
}

function saveBlockedUsers() {
  fs.writeFileSync('./block.json', JSON.stringify(blockedUsers, null, 2));
}

client.on('ready', () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  
  client.user.setPresence({
    activities: [{
      name: '.gg/408',
      type: 3
    }],
    status: 'idle'
  });
  
  console.log('✅ تم تعيين حالة البوت: Watching .gg/408');
  
  // الدخول للروم الصوتي
  joinVoiceChannelFunc();
});

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
        console.log('⚠️ تم قطع الاتصال من الروم الصوتي، جاري إعادة الاتصال...');
        setTimeout(() => {
          joinVoiceChannelFunc();
        }, 3000);
      }
    });

  } catch (error) {
    console.error('❌ خطأ في الدخول للروم الصوتي:', error);
    setTimeout(() => {
      joinVoiceChannelFunc();
    }, 5000);
  }
}

// مراقبة إذا تم طرد البوت من الروم
client.on('voiceStateUpdate', (oldState, newState) => {
  if (newState.id === client.user.id) {
    if (oldState.channelId === VOICE_CHANNEL_ID && newState.channelId !== VOICE_CHANNEL_ID) {
      console.log('⚠️ تم طرد البوت من الروم الصوتي، جاري إعادة الدخول...');
      setTimeout(() => {
        joinVoiceChannelFunc();
      }, 2000);
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // أمر الحظر
  if (message.content.startsWith('-block')) {
    const hasPermission = message.member.roles.cache.has(ADMIN_ROLE_1) || message.member.roles.cache.has(ADMIN_ROLE_2);
    
    if (!hasPermission) {
      return message.reply('❌ ليس لديك صلاحية لاستخدام هذا الأمر!');
    }

    const mentionedUser = message.mentions.users.first();
    if (!mentionedUser) {
      return message.reply('❌ يجب عليك منشن الشخص! مثال: `-block @user`');
    }

    blockedUsers[mentionedUser.id] = true;
    saveBlockedUsers();
    
    return message.reply(`✅ تم حظر ${mentionedUser} من فتح التيكتات!`);
  }

  // أمر إلغاء الحظر
  if (message.content.startsWith('-unblock')) {
    const hasPermission = message.member.roles.cache.has(ADMIN_ROLE_1) || message.member.roles.cache.has(ADMIN_ROLE_2);
    
    if (!hasPermission) {
      return message.reply('❌ ليس لديك صلاحية لاستخدام هذا الأمر!');
    }

    const mentionedUser = message.mentions.users.first();
    if (!mentionedUser) {
      return message.reply('❌ يجب عليك منشن الشخص! مثال: `-unblock @user`');
    }

    if (!blockedUsers[mentionedUser.id]) {
      return message.reply('❌ هذا الشخص غير محظور!');
    }

    delete blockedUsers[mentionedUser.id];
    saveBlockedUsers();
    
    return message.reply(`✅ تم إلغاء حظر ${mentionedUser} من فتح التيكتات!`);
  }

  // أمر إعداد التيكت
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
      setTimeout(async () => {
        try {
          await message.delete();
        } catch (error) {
          console.error('خطأ في حذف الرسالة:', error);
        }
      }, 3000);
      return;
    }

    await message.delete();

    try {
      await member.send('**تفعيلك بالانتظار ⏳**\n**The great\'s**');
    } catch (error) {
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

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  // معالجة زر فتح التيكت
  if (interaction.customId === 'open_ticket') {
    await interaction.deferReply({ flags: 64 });

    try {
      const guild = interaction.guild;
      const member = interaction.member;
      
      // التحقق من الحظر
      if (blockedUsers[member.id]) {
        return interaction.editReply({ content: '❌ أنت محظور من فتح التيكتات!', flags: 64 });
      }
      
      // التحقق من وجود تيكت مفتوح بالفعل
      const existingTicket = guild.channels.cache.find(
        ch => ch.name === `${member.user.username}-ticket` && ch.parentId === TICKET_CATEGORY_ID
      );

      if (existingTicket) {
        return interaction.editReply({ content: '❌ لديك تيكت مفتوح بالفعل!', flags: 64 });
      }

      // إنشاء التيكت
      const ticketChannel = await guild.channels.create({
        name: `${member.user.username}-ticket`,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: member.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          },
          {
            id: ADMIN_ROLE_1,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          },
          {
            id: ADMIN_ROLE_2,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          },
          {
            id: TICKET_MANAGER_ROLE_1,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          },
          {
            id: TICKET_MANAGER_ROLE_2,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          },
          {
            id: TICKET_MANAGER_ROLE_3,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          }
        ]
      });

      const ticketAttachment = new AttachmentBuilder('./man.jpg');
      
      const ticketEmbed = new EmbedBuilder()
        .setColor('#FFFFFF')
        .setImage('attachment://man.jpg');

      const ticketRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('add_member')
            .setLabel('Add Member')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('call_owner')
            .setLabel('Call Owner')
            .setStyle(ButtonStyle.Secondary)
        );

      await ticketChannel.send({ 
        content: `${member}`,
        embeds: [ticketEmbed], 
        components: [ticketRow],
        files: [ticketAttachment]
      });

      await interaction.editReply({ content: `✅ تم فتح التيكت الخاص بك ${ticketChannel}`, flags: 64 });

    } catch (error) {
      console.error('❌ خطأ في إنشاء التيكت:', error);
      await interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء التيكت!', flags: 64 });
    }
    return;
  }

  // معالجة أزرار التيكت
  if (interaction.customId === 'close_ticket') {
    const member = interaction.member;
    const hasPermission = member.roles.cache.has(ADMIN_ROLE_1) || 
                         member.roles.cache.has(ADMIN_ROLE_2) ||
                         member.roles.cache.has(TICKET_MANAGER_ROLE_1) ||
                         member.roles.cache.has(TICKET_MANAGER_ROLE_2) ||
                         member.roles.cache.has(TICKET_MANAGER_ROLE_3);
    
    if (!hasPermission) {
      return interaction.reply({ content: '❌ ليس لديك صلاحية لإغلاق التيكت!', flags: 64 });
    }

    await interaction.reply({ content: '⏳ جاري إغلاق التيكت...', flags: 64 });
    
    setTimeout(async () => {
      await interaction.channel.delete();
    }, 3000);
    return;
  }

  if (interaction.customId === 'add_member') {
    const member = interaction.member;
    const hasPermission = member.roles.cache.has(ADMIN_ROLE_1) || 
                         member.roles.cache.has(ADMIN_ROLE_2) ||
                         member.roles.cache.has(TICKET_MANAGER_ROLE_1) ||
                         member.roles.cache.has(TICKET_MANAGER_ROLE_2) ||
                         member.roles.cache.has(TICKET_MANAGER_ROLE_3);
    
    if (!hasPermission) {
      return interaction.reply({ content: '❌ ليس لديك صلاحية لإضافة أعضاء!', flags: 64 });
    }

    const modal = new ModalBuilder()
      .setCustomId('add_member_modal')
      .setTitle('إضافة عضو للتيكت');

    const userIdInput = new TextInputBuilder()
      .setCustomId('user_id')
      .setLabel('آيدي العضو')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('123456789012345678')
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(userIdInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }

  if (interaction.customId === 'call_owner') {
    await interaction.deferReply();
    
    const owner = await interaction.guild.fetchOwner();
    
    await interaction.editReply({ content: `${owner} تم استدعاؤك!` });
    return;
  }

  // معالجة أزرار التفعيل
  const member = interaction.member;
  const hasPermission = member.roles.cache.has(ADMIN_ROLE_1) || member.roles.cache.has(ADMIN_ROLE_2);
  
  if (!hasPermission) {
    return interaction.reply({ content: '❌ ليس لديك صلاحية لاستخدام هذا الزر!', flags: 64 });
  }

  await interaction.deferUpdate();

  const [action, userId] = interaction.customId.split('_');
  const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);

  if (!targetMember) {
    return interaction.followUp({ content: '❌ العضو غير موجود في السيرفر!', flags: 64 });
  }

  try {
    if (action === 'approve') {
      await targetMember.roles.add(VERIFIED_ROLE_ID);
      
      try {
        await targetMember.send('**تم تفعيلك بالسيرفر بنجاح <:2613verifiedwhitealternative:1456630238699196573>**\n**The great\'s**');
      } catch (error) {
        console.error('❌ لا يمكن إرسال رسالة خاصة للعضو');
      }

      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor('#57F287')
        .addFields({ name: '✅ النتيجة', value: `تم القبول بواسطة ${interaction.user}` });

      const disabledRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('approved')
            .setLabel('✅ تم القبول')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('rejected')
            .setLabel('❌ رفض')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

      await interaction.editReply({ embeds: [updatedEmbed], components: [disabledRow] });
      console.log(`✅ تم قبول طلب التفعيل للعضو: ${targetMember.user.tag}`);

    } else if (action === 'reject') {
      try {
        await targetMember.send('**تم رفض طلب تفعيلك ❌**\n**The great\'s**');
      } catch (error) {
        console.error('❌ لا يمكن إرسال رسالة خاصة للعضو');
      }

      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor('#ED4245')
        .addFields({ name: '❌ النتيجة', value: `تم الرفض بواسطة ${interaction.user}` });

      const disabledRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('approved')
            .setLabel('✅ قبول')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('rejected')
            .setLabel('❌ تم الرفض')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
        );

      await interaction.editReply({ embeds: [updatedEmbed], components: [disabledRow] });
      console.log(`❌ تم رفض طلب التفعيل للعضو: ${targetMember.user.tag}`);
    }

  } catch (error) {
    console.error('❌ حدث خطأ:', error);
    try {
      await interaction.followUp({ content: '❌ حدث خطأ أثناء معالجة الطلب!', flags: 64 });
    } catch (e) {
      console.error('❌ خطأ في إرسال رسالة الخطأ:', e);
    }
  }
});

// معالجة المودال
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId === 'add_member_modal') {
    const userId = interaction.fields.getTextInputValue('user_id');
    
    try {
      const memberToAdd = await interaction.guild.members.fetch(userId);
      
      await interaction.channel.permissionOverwrites.create(memberToAdd, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });

      await interaction.reply({ content: `✅ تم إضافة ${memberToAdd} للتيكت بنجاح!` });
    } catch (error) {
      console.error('❌ خطأ في إضافة العضو:', error);
      await interaction.reply({ content: '❌ فشل في إضافة العضو! تأكد من صحة الآيدي.', flags: 64 });
    }
  }
});

client.login(BOT_TOKEN);
