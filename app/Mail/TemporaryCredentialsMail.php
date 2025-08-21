<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class TemporaryCredentialsMail extends Mailable
{
    use Queueable, SerializesModels;

    public $user;
    public $temporaryPassword;

    public function __construct($user, $temporaryPassword)
    {
        $this->user = $user;
        $this->temporaryPassword = $temporaryPassword;
    }

    public function build()
    {
        $loginUrl = url(route('login'));

        return $this->subject('【重要】アカウントのログイン情報')
            ->view('emails.temporary_credentials')
            ->with([
                'name' => $this->user->name,
                'email' => $this->user->email,
                'temporary_password' => $this->temporaryPassword,
                'login_url' => $loginUrl,
            ]);
    }
}
