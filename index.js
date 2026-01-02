const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const VERIFICATION_CHANNEL_ID = '1454048516266528768';
const APPROVAL_CHANNEL_ID = '1456634920092045498';
const VERIFIED_ROLE_ID = '1446859259840036924';
const ADMIN_ROLE_1 = '1455684787804307590';
const ADMIN_ROLE_2 = '1442691051990024435';
const BOT_TOKEN = 'MTQ1NjYyOTQ3OTk4MzAyMjMyOA.G5DjCD.6yTk2dKGoUwZWWaowK64jJAv8ZeqyzxXnh9yjE';

client.on('ready', () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== VERIFICATION_CHANNEL_ID) return;
  if (message.content.trim() !== '.') return;

  try {
    const member = message.member;
    const role = message.guild.roles.cache.get(VERIFIED_ROLE_ID);

    if (!role) {
      console.error('❌ الرول غير موجود!');
      return;
    }

    // التحقق إذا كان العضو لديه الرول بالفعل
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

    // حذف رسالة النقطة
    await message.delete();

    // إرسال رسالة للعضو: تفعيلك بالانتظار
    try {
      await member.send('**تفعيلك بالانتظار ⏳**\n**The great\'s**');
    } catch (error) {
      console.error('❌ لا يمكن إرسال رسالة خاصة للعضو');
    }

    // إرسال طلب التفعيل في روم الموافقات
    const approvalChannel = message.guild.channels.cache.get(APPROVAL_CHANNEL_ID);
    if (!approvalChannel) {
      console.error('❌ روم الموافقات غير موجود!');
      return;
    }

    // إنشاء الإمبد
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('طلب تفعيل')
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: 'الاسم', value: member.user.displayName, inline: true },
        { name: 'اليوزر', value: `@${member.user.username}`, inline: true },
        { name: 'المنشن', value: `${member}`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `User ID: ${member.user.id}` });

    // إنشاء الأزرار
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

// معالجة الأزرار
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const member = interaction.member;
  
  // التحقق من صلاحية المستخدم
  const hasPermission = member.roles.cache.has(ADMIN_ROLE_1) || member.roles.cache.has(ADMIN_ROLE_2);
  
  if (!hasPermission) {
    return interaction.reply({ content: '❌ ليس لديك صلاحية لاستخدام هذا الزر!', ephemeral: true });
  }

  const [action, userId] = interaction.customId.split('_');
  const targetMember = await interaction.guild.members.fetch(userId).catch(() => null);

  if (!targetMember) {
    return interaction.reply({ content: '❌ العضو غير موجود في السيرفر!', ephemeral: true });
  }

  try {
    if (action === 'approve') {
      // إعطاء الرول
      await targetMember.roles.add(VERIFIED_ROLE_ID);
      
      // إرسال رسالة للعضو
      try {
        await targetMember.send('**تم تفعيلك بالسيرفر بنجاح <:2613verifiedwhitealternative:1456630238699196573>**\n**The great\'s**');
      } catch (error) {
        console.error('❌ لا يمكن إرسال رسالة خاصة للعضو');
      }

      // تحديث الإمبد
      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor('#57F287')
        .addFields({ name: '✅ النتيجة', value: `تم القبول بواسطة ${interaction.user}` });

      // تعطيل الأزرار
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

      await interaction.update({ embeds: [updatedEmbed], components: [disabledRow] });
      console.log(`✅ تم قبول طلب التفعيل للعضو: ${targetMember.user.tag}`);

    } else if (action === 'reject') {
      // إرسال رسالة للعضو
      try {
        await targetMember.send('**تم رفض طلب تفعيلك ❌**\n**The great\'s**');
      } catch (error) {
        console.error('❌ لا يمكن إرسال رسالة خاصة للعضو');
      }

      // تحديث الإمبد
      const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor('#ED4245')
        .addFields({ name: '❌ النتيجة', value: `تم الرفض بواسطة ${interaction.user}` });

      // تعطيل الأزرار
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

      await interaction.update({ embeds: [updatedEmbed], components: [disabledRow] });
      console.log(`❌ تم رفض طلب التفعيل للعضو: ${targetMember.user.tag}`);
    }

  } catch (error) {
    console.error('❌ حدث خطأ:', error);
    await interaction.reply({ content: '❌ حدث خطأ أثناء معالجة الطلب!', ephemeral: true });
  }
});

client.login(BOT_TOKEN);