package com.labguard.controller;

import com.labguard.dto.IssueDtos.*;
import com.labguard.entity.User;
import com.labguard.repository.UserRepository;
import com.labguard.service.IssueService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/issues")
@RequiredArgsConstructor
public class IssueController {

    private final IssueService issueService;
    private final UserRepository userRepository;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'LAB_ASSISTANT', 'FACULTY')")
    public ResponseEntity<List<IssueDetailDto>> getAllIssues() {
        return ResponseEntity.ok(issueService.getAllIssues());
    }

    @GetMapping("/my-issues")
    public ResponseEntity<List<IssueDetailDto>> getMyReportedIssues(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(issueService.getIssuesReportedByUser(user.getId()));
    }

    @GetMapping("/lab/{labId}")
    @PreAuthorize("@labSecurity.hasLabAccess(authentication, #labId)")
    public ResponseEntity<List<IssueDetailDto>> getIssuesByLab(@PathVariable UUID labId) {
        return ResponseEntity.ok(issueService.getIssuesByLab(labId));
    }

    @GetMapping("/{issueId}")
    public ResponseEntity<IssueDetailDto> getIssueDetail(@PathVariable UUID issueId) {
        return ResponseEntity.ok(issueService.getIssueDetail(issueId));
    }

    @PostMapping
    public ResponseEntity<IssueDetailDto> reportIssue(
        @Valid @RequestBody CreateIssueRequest request,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User reporter = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        IssueDetailDto created = issueService.createIssue(request, reporter);
        return ResponseEntity.ok(created);
    }

    @PatchMapping("/{issueId}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'LAB_ASSISTANT', 'FACULTY')")
    public ResponseEntity<IssueDetailDto> updateStatus(
        @PathVariable UUID issueId,
        @Valid @RequestBody UpdateIssueStatusRequest request,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User actor = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
        IssueDetailDto updated = issueService.updateIssueStatus(issueId, request, actor);
        return ResponseEntity.ok(updated);
    }
}
