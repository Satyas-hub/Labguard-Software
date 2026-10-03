package com.labguard.controller;

import com.labguard.dto.AuthDtos.*;
import com.labguard.entity.User;
import com.labguard.repository.UserRepository;
import com.labguard.service.AuthService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
        @Valid @RequestBody LoginRequest request,
        HttpServletResponse response
    ) {
        AuthResponse authResponse = authService.login(request, response);
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
        HttpServletResponse response,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userDetails != null ? userRepository.findByEmail(userDetails.getUsername()).orElse(null) : null;
        authService.logout(response, user);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<CurrentUserResponse> getCurrentUser(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).build();
        }
        CurrentUserResponse currentUser = authService.getCurrentUser(userDetails.getUsername());
        return ResponseEntity.ok(currentUser);
    }

    /**
     * Windows Lab PC Kiosk Authentication Endpoint
     */
    @PostMapping("/client-authenticate")
    public ResponseEntity<ClientAuthResponse> clientAuthenticate(@Valid @RequestBody ClientAuthRequest request) {
        ClientAuthResponse response = authService.authenticateClientKiosk(request);
        return ResponseEntity.ok(response);
    }
}
