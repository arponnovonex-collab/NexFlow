<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    public function up(): void
    {
        $user = User::where('email', 'atanjimurrahman@gmail.com')->first();
        if ($user) {
            $user->update([
                'name' => 'Tanjimur Rahman Arpon',
                'phone' => '01580401289',
                'role' => 'super_admin',
                'status' => 'active',
            ]);
            return;
        }

        $oldAdmin = User::where('email', 'admin@nexflow.ai')
            ->orWhere('role', 'super_admin')
            ->first();

        if ($oldAdmin) {
            $oldAdmin->update([
                'name' => 'Tanjimur Rahman Arpon',
                'email' => 'atanjimurrahman@gmail.com',
                'phone' => '01580401289',
                'role' => 'super_admin',
                'status' => 'active',
            ]);
            return;
        }

        User::create([
            'name' => 'Tanjimur Rahman Arpon',
            'email' => 'atanjimurrahman@gmail.com',
            'password' => Hash::make('password123'),
            'phone' => '01580401289',
            'role' => 'super_admin',
            'status' => 'active',
        ]);
    }

    public function down(): void
    {
        // No-op
    }
};

