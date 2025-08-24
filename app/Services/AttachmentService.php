<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;

class AttachmentService
{
    public function store($file)
    {
        // store in 'attachments' disk (public)
        $path = $file->store('attachments', 'public');
        return $path;
    }
}
