const getCurrentChannelName = () => {
  const channel = Session.get('messagesChannel');
  if (!channel) return '-';

  if (channel.includes('zon_')) return Zones.findOne(channel)?.name || 'Zone';
  else if (channel.includes('qst_')) return '';

  const userIds = channel.split(';');
  const users = Meteor.users.find({ _id: { $in: userIds } }).fetch();
  const userNames = users.map(user => user.profile.name);

  return userNames.join(' & ');
};

const sortedMessages = () => Messages.find({}, { sort: { createdAt: 1 } }).fetch();

const scrollToBottom = () => {
  const messagesElement = document.querySelector('.messages-list');
  if (messagesElement) messagesElement.scrollTop = messagesElement.scrollHeight;
};

Template.messagesListMessage.onCreated(function () {
  this.moderationAllowed = messageModerationAllowed(Meteor.userId(), this.data.message);
});

Template.messagesListMessage.helpers({
  user() { return Meteor.users.findOne(this.message.createdBy); },
  userName() { return Meteor.users.findOne(this.message.createdBy)?.profile.name || '[removed]'; },
  text() { return this.message.text; },
  file() {
    if (!this.message.fileId) return undefined;
    return Files.findOne(this.message.fileId);
  },
  date() { return this.message.createdAt.toDateString(); },
  time() { return this.message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); },
  showActions() { return Template.instance().moderationAllowed; },
});

Template.messagesListMessage.events({
  'click .js-username'(e, instance) {
    e.preventDefault();
    e.stopPropagation();
    const userId = instance.data.message.createdBy;
    if (userId) Session.set('modal', { template: 'profile', userId });
  },
  'click .js-message-remove'(e, instance) {
    const messageId = instance.data.message._id;
    lp.notif.confirm('Delete message', `Do you really want to delete this message?`, () => Messages.remove(messageId));
  },
});

Template.messagesList.onCreated(function () {
  this.userSubscribeHandler = undefined;
  this.fileSubscribeHandler = undefined;

  this.autorun(() => {
    if (!Session.get('console')) {
      this.fileSubscribeHandler?.stop();
      this.userSubscribeHandler?.stop();
      return;
    }

    const messages = Messages.find({}, { fields: { createdBy: 1, fileId: 1 } }).fetch();

    const userIds = messages.map(message => message.createdBy).filter(Boolean);
    this.userSubscribeHandler = this.subscribe('usernames', userIds, () => scrollToBottom());

    const filesIds = messages.map(message => message.fileId).filter(Boolean);
    this.fileSubscribeHandler = this.subscribe('files', filesIds);
  });
});

Template.messagesList.helpers({
  show() { return Session.get('console'); },
  channelName() { return getCurrentChannelName(); },
  messages() { return sortedMessages(); },
  sameDay(index) {
    if (index === 0) return true;

    const messages = sortedMessages();
    if (index >= messages.length) return true;
    return new Date(messages[index].createdAt).getDate() === new Date(messages[index - 1].createdAt).getDate();
  },
  formattedSeparationDate(index) {
    const messages = sortedMessages();
    const messageDate = new Date(messages[index].createdAt);

    const date = new Date();
    if (messageDate.getDate() === date.getDate()) return 'Today';
    if (messageDate.getDate() === date.getDate() - 1) return 'Yesterday';

    return messageDate.toDateString();
  },
});
