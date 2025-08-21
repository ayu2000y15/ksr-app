<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Illuminate\Support\Facades\Redirect;

class ChangePasswordController extends Controller
{
    public function update(Request $request)
    {
        $messages = [
            'password.required' => 'パスワードは必須です。',
            'password.confirmed' => '確認用パスワードが一致しません。',
            'password.min' => 'パスワードは:min文字以上で入力してください。',
            'password.letters' => 'パスワードは少なくとも1文字の英字を含めてください。',
            'password.mixed' => 'パスワードは大文字と小文字を両方含めてください。',
            'password.numbers' => 'パスワードは少なくとも1つの数字を含めてください。',
            'password.symbols' => 'パスワードは少なくとも1つの記号を含めてください。',
            'password.uncompromised' => 'そのパスワードは以前に漏洩している可能性があるため使用できません。別のパスワードをお試しください。',
        ];

        $request->validate([
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ], $messages);

        $user = $request->user();
        if (! $user) {
            return Redirect::route('login');
        }

        $user->password = Hash::make($request->password);
        $user->must_change_password = false;
        $user->temporary_password = null;
        $user->temporary_password_expires_at = null;
        $user->save();

        return Redirect::route('dashboard')->with('success', 'パスワードを変更しました。');
    }
}
