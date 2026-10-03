package com.labguard.controller;

import com.labguard.dto.NotificationDtos.*;
import com.labguard.entity.User;
import com.labguard.repository.UserRepository;
import com.labguard.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final UserRepository userRepository;

    @GetMapping("/api/notifications")
    public ResponseEntity<List<NotificationItemDto>> getNotifications(
        @RequestParam(required = false, defaultValue = "ALL") String filter,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        List<NotificationItemDto> list = notificationService.getUserNotifications(user.getId(), filter);
        return ResponseEntity.ok(list);
    }

    @GetMapping("/api/notifications/badge")
    public ResponseEntity<NotificationBadgeDto> getBadge(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        NotificationBadgeDto badge = notificationService.getNotificationBadge(user.getId());
        return ResponseEntity.ok(badge);
    }

    @PostMapping("/api/notifications/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable UUID id, @AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        notificationService.markAsRead(id, user.getId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/api/notifications/mark-all-read")
    public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        notificationService.markAllAsRead(user.getId());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/api/notification-preferences")
    public ResponseEntity<NotificationPreferenceDto> getPreferences(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(notificationService.getPreferences(user.getId()));
    }

    @PutMapping("/api/notification-preferences")
    public ResponseEntity<Void> updatePreferences(
        @RequestBody NotificationPreferenceDto dto,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        notificationService.updatePreferences(user.getId(), dto);
        return ResponseEntity.ok().build();
    }
}
