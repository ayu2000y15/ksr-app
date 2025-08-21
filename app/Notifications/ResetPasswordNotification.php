<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordNotification extends Notification
{
    public $token;

    public function __construct($token)
    {
        $this->token = $token;
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        $url = url(route('password.reset', ['token' => $this->token, 'email' => $notifiable->getEmailForPasswordReset()], false));

        return (new MailMessage)
            ->subject('パスワード再設定のお知らせ')
            ->line('パスワードの再設定をリクエストされました。以下のボタンから再設定してください。')
            ->action('パスワードを再設定する', $url)
            ->line('このリクエストに心当たりがない場合は、このメールを破棄してください。');
    }
}
