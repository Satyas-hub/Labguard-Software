package com.labguard.controller;

import com.labguard.dto.SessionDtos.SessionDetailDto;
import com.labguard.entity.User;
import com.labguard.repository.UserRepository;
import com.labguard.service.SessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;
    private final UserRepository userRepository;

    @GetMapping("/my-active")
    public ResponseEntity<SessionDetailDto> getMyActiveSession(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        return sessionService.getActiveSessionForUser(user.getId())
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/my-history")
    public ResponseEntity<List<SessionDetailDto>> getMySessionHistory(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        List<SessionDetailDto> history = sessionService.getSessionHistoryForUser(user.getId());
        return ResponseEntity.ok(history);
    }

    @GetMapping("/lab/{labId}")
    @PreAuthorize("@labSecurity.hasLabAccess(authentication, #labId)")
    public ResponseEntity<List<SessionDetailDto>> getSessionsByLab(@PathVariable UUID labId) {
        List<SessionDetailDto> list = sessionService.getAllSessionsInLab(labId);
        return ResponseEntity.ok(list);
    }

    @PostMapping("/{sessionId}/end")
    @PreAuthorize("@labSecurity.canAccessSession(authentication, #sessionId)")
    public ResponseEntity<SessionDetailDto> endSession(
        @PathVariable UUID sessionId,
        @RequestParam(required = false, defaultValue = "COMPLETED") String reason,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User actor = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        SessionDetailDto ended = sessionService.endSession(sessionId, reason, actor);
        return ResponseEntity.ok(ended);
    }
}
